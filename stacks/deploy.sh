#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PREFIX="ghcr.io/odigos-io/synthetic-apps"
# How many backend stacks to deploy (1–5): redis, kafka, postgres, messaging, search
STACKS="${STACKS:-5}"

if ! [[ "$STACKS" =~ ^[1-5]$ ]]; then
  echo "STACKS must be an integer from 1 to 5 (got: $STACKS)" >&2
  exit 1
fi

declare -a STACK_LABELS=(redis kafka postgres messaging search)
declare -a STACK_NAMESPACES=(stacks-redis stacks-kafka stacks-postgres stacks-messaging stacks-search)
declare -a STACK_MANIFESTS=(k8s/redis-stack.yaml k8s/kafka-stack.yaml k8s/postgres-stack.yaml k8s/messaging-stack.yaml k8s/search-stack.yaml)

selected_stacks() {
  local i
  for ((i = 0; i < STACKS; i++)); do
    echo "$i"
  done
}

build_gateway() {
  echo "==> Building stacks-gateway"
  docker build -f gateway/Dockerfile -t "${PREFIX}/stacks-gateway:stacks" .
}

build_stack() {
  local idx="$1"
  case "$idx" in
    0)
      echo "==> Building redis stack (4 apps)"
      docker build -f redis-stack/session-python/Dockerfile -t "${PREFIX}/stacks-redis-session-python:stacks" .
      docker build -f redis-stack/cache-go/Dockerfile -t "${PREFIX}/stacks-redis-cache-go:stacks" .
      docker build -f redis-stack/notifier-java/Dockerfile -t "${PREFIX}/stacks-redis-notifier-java:stacks" .
      docker build -f redis-stack/worker-nodejs/Dockerfile -t "${PREFIX}/stacks-redis-worker-nodejs:stacks" .
      ;;
    1)
      echo "==> Building kafka stack (4 apps)"
      docker build -f kafka-stack/processor-java/Dockerfile -t "${PREFIX}/stacks-kafka-processor-java:stacks" .
      docker build -f kafka-stack/inventory-go/Dockerfile -t "${PREFIX}/stacks-kafka-inventory-go:stacks" .
      docker build -f kafka-stack/analytics-python/Dockerfile -t "${PREFIX}/stacks-kafka-analytics-python:stacks" .
      docker build -f kafka-stack/relay-nodejs/Dockerfile -t "${PREFIX}/stacks-kafka-relay-nodejs:stacks" .
      ;;
    2)
      echo "==> Building postgres stack (4 apps)"
      docker build -f postgres-stack/users-go/Dockerfile -t "${PREFIX}/stacks-postgres-users-go:stacks" .
      docker build -f postgres-stack/orders-python/Dockerfile -t "${PREFIX}/stacks-postgres-orders-python:stacks" .
      docker build -f postgres-stack/billing-java/Dockerfile -t "${PREFIX}/stacks-postgres-billing-java:stacks" .
      docker build -f postgres-stack/audit-go/Dockerfile -t "${PREFIX}/stacks-postgres-audit-go:stacks" .
      ;;
    3)
      echo "==> Building messaging stack (5 apps)"
      docker build -f messaging-stack/gateway-nestjs/Dockerfile -t "${PREFIX}/stacks-messaging-gateway:stacks" .
      docker build -f messaging-stack/fastapi-products/Dockerfile -t "${PREFIX}/stacks-messaging-fastapi:stacks" .
      docker build -f messaging-stack/quarkus-pricing/Dockerfile -t "${PREFIX}/stacks-messaging-quarkus:stacks" .
      docker build -f messaging-stack/gin-recommendations/Dockerfile -t "${PREFIX}/stacks-messaging-gin:stacks" .
      docker build -f messaging-stack/worker-nestjs/Dockerfile -t "${PREFIX}/stacks-messaging-worker:stacks" .
      ;;
    4)
      echo "==> Building search stack (5 apps)"
      docker build -f search-stack/gateway-dotnet/Dockerfile -t "${PREFIX}/stacks-search-gateway:stacks" .
      docker build -f search-stack/django-crm/Dockerfile -t "${PREFIX}/stacks-search-django:stacks" .
      docker build -f search-stack/go-indexer/Dockerfile -t "${PREFIX}/stacks-search-indexer:stacks" .
      docker build -f search-stack/php-shipping/Dockerfile -t "${PREFIX}/stacks-search-php:stacks" .
      docker build -f search-stack/nodejs-cache/Dockerfile -t "${PREFIX}/stacks-search-cache:stacks" .
      ;;
  esac
}

load_stack_images() {
  local idx="$1"
  case "$idx" in
    0)
      kind load docker-image "${PREFIX}/stacks-redis-session-python:stacks"
      kind load docker-image "${PREFIX}/stacks-redis-cache-go:stacks"
      kind load docker-image "${PREFIX}/stacks-redis-notifier-java:stacks"
      kind load docker-image "${PREFIX}/stacks-redis-worker-nodejs:stacks"
      ;;
    1)
      kind load docker-image "${PREFIX}/stacks-kafka-processor-java:stacks"
      kind load docker-image "${PREFIX}/stacks-kafka-inventory-go:stacks"
      kind load docker-image "${PREFIX}/stacks-kafka-analytics-python:stacks"
      kind load docker-image "${PREFIX}/stacks-kafka-relay-nodejs:stacks"
      ;;
    2)
      kind load docker-image "${PREFIX}/stacks-postgres-users-go:stacks"
      kind load docker-image "${PREFIX}/stacks-postgres-orders-python:stacks"
      kind load docker-image "${PREFIX}/stacks-postgres-billing-java:stacks"
      kind load docker-image "${PREFIX}/stacks-postgres-audit-go:stacks"
      ;;
    3)
      kind load docker-image "${PREFIX}/stacks-messaging-gateway:stacks"
      kind load docker-image "${PREFIX}/stacks-messaging-fastapi:stacks"
      kind load docker-image "${PREFIX}/stacks-messaging-quarkus:stacks"
      kind load docker-image "${PREFIX}/stacks-messaging-gin:stacks"
      kind load docker-image "${PREFIX}/stacks-messaging-worker:stacks"
      ;;
    4)
      kind load docker-image "${PREFIX}/stacks-search-gateway:stacks"
      kind load docker-image "${PREFIX}/stacks-search-django:stacks"
      kind load docker-image "${PREFIX}/stacks-search-indexer:stacks"
      kind load docker-image "${PREFIX}/stacks-search-php:stacks"
      kind load docker-image "${PREFIX}/stacks-search-cache:stacks"
      ;;
  esac
}

rollout_stack() {
  local idx="$1"
  case "$idx" in
    0)
      echo "==> Waiting for redis stack..."
      kubectl rollout status deployment/redis deployment/session-python deployment/cache-go \
        deployment/notifier-java deployment/worker-nodejs -n stacks-redis --timeout=180s
      ;;
    1)
      echo "==> Waiting for kafka stack..."
      kubectl rollout status deployment/kafka-broker deployment/processor-java deployment/inventory-go \
        deployment/analytics-python deployment/relay-nodejs -n stacks-kafka --timeout=240s
      ;;
    2)
      echo "==> Waiting for postgres stack..."
      kubectl rollout status deployment/postgres deployment/users-go deployment/orders-python \
        deployment/billing-java deployment/audit-go -n stacks-postgres --timeout=180s
      ;;
    3)
      echo "==> Waiting for messaging stack..."
      kubectl rollout status deployment/mongodb deployment/rabbitmq deployment/messaging-gateway \
        deployment/fastapi-products deployment/quarkus-pricing deployment/gin-recommendations \
        deployment/messaging-worker -n stacks-messaging --timeout=300s
      ;;
    4)
      echo "==> Waiting for search stack..."
      kubectl rollout status deployment/mysql deployment/elasticsearch deployment/memcached \
        deployment/search-gateway deployment/django-crm deployment/go-indexer \
        deployment/php-shipping deployment/nodejs-cache -n stacks-search --timeout=360s
      ;;
  esac
}

deploy_summary() {
  local names=""
  local idx
  for idx in $(selected_stacks); do
    names="${names}${STACK_LABELS[$idx]} "
  done
  echo ""
  echo "Deployed: stacks-gateway + ${STACKS} stack(s): ${names% }"
  echo "  Gateway: stacks/stacks-gateway"
  echo "  Trigger: make trigger-traffic"
}

build() {
  echo "==> Building gateway + ${STACKS} stack(s)"
  build_gateway
  local idx
  for idx in $(selected_stacks); do
    build_stack "$idx"
  done
  echo "==> Done building"
}

load_to_kind() {
  echo "==> Loading gateway image"
  kind load docker-image "${PREFIX}/stacks-gateway:stacks"
  local idx
  for idx in $(selected_stacks); do
    echo "==> Loading ${STACK_LABELS[$idx]} stack images"
    load_stack_images "$idx"
  done
}

apply() {
  kubectl create namespace stacks --dry-run=client -o yaml | kubectl apply -f -
  local idx
  for idx in $(selected_stacks); do
    kubectl create namespace "${STACK_NAMESPACES[$idx]}" --dry-run=client -o yaml | kubectl apply -f -
  done
  kubectl apply -f k8s/gateway.yaml
  for idx in $(selected_stacks); do
    kubectl apply -n "${STACK_NAMESPACES[$idx]}" -f "${STACK_MANIFESTS[$idx]}"
  done
  kubectl apply -f k8s/odigos-instrument.yaml
}

rollout() {
  echo "==> Waiting for stacks-gateway..."
  kubectl rollout status deployment/stacks-gateway -n stacks --timeout=180s
  local idx
  for idx in $(selected_stacks); do
    rollout_stack "$idx"
  done
}

deploy() {
  build
  load_to_kind
  apply
  rollout
  deploy_summary
}

trigger_traffic() {
  local replicas="${TRAFFIC_REPLICAS:-10}"
  local duration="${TRAFFIC_DURATION_SECONDS:-3600}"
  local parallel="${TRAFFIC_PARALLEL:-6}"
  kubectl delete job stacks-traffic -n stacks --ignore-not-found=true
  kubectl delete deployment stacks-traffic -n stacks --ignore-not-found=true
  sed \
    -e "s/replicas: 10/replicas: ${replicas}/" \
    -e "s/value: \"3600\"/value: \"${duration}\"/" \
    -e "s/value: \"6\"/value: \"${parallel}\"/" \
    k8s/traffic-deployment.yaml | kubectl apply -f -
  echo ""
  echo "BOOM → stacks-gateway (${STACKS} stack(s) deployed)"
  echo "Stop: make stop-traffic"
}

stop_traffic() {
  kubectl delete deployment stacks-traffic -n stacks --ignore-not-found=true
  kubectl delete job stacks-traffic -n stacks --ignore-not-found=true
  echo "Traffic stopped."
}

status() {
  echo "=== stacks ==="
  kubectl get pods,svc -n stacks 2>/dev/null || true
  local idx
  for idx in $(selected_stacks); do
    echo "=== ${STACK_NAMESPACES[$idx]} (${STACK_LABELS[$idx]}) ==="
    kubectl get pods,svc -n "${STACK_NAMESPACES[$idx]}" 2>/dev/null || true
  done
}

clean() {
  kubectl delete namespace stacks --ignore-not-found=true
  local idx
  for idx in $(selected_stacks); do
    kubectl delete namespace "${STACK_NAMESPACES[$idx]}" --ignore-not-found=true
  done
}

case "${1:-deploy}" in
  build) build ;;
  load-to-kind) load_to_kind ;;
  apply) apply ;;
  rollout) rollout ;;
  deploy) deploy ;;
  traffic) trigger_traffic ;;
  stop-traffic) stop_traffic ;;
  status) status ;;
  clean) clean ;;
  *)
    echo "Usage: STACKS=1-5 $0 {build|load-to-kind|apply|rollout|deploy|traffic|stop-traffic|status|clean}"
    echo ""
    echo "Stacks (in order): redis kafka postgres messaging search"
    echo "  STACKS=2  → gateway + redis + kafka"
    echo "  STACKS=5  → all stacks (default)"
    exit 1
    ;;
esac
