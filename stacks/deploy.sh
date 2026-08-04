#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PREFIX="ghcr.io/odigos-io/synthetic-apps"

declare -a IMAGES=(
  "${PREFIX}/stacks-gateway:stacks"
  "${PREFIX}/stacks-redis-session-python:stacks"
  "${PREFIX}/stacks-redis-cache-go:stacks"
  "${PREFIX}/stacks-redis-notifier-java:stacks"
  "${PREFIX}/stacks-redis-worker-nodejs:stacks"
  "${PREFIX}/stacks-kafka-processor-java:stacks"
  "${PREFIX}/stacks-kafka-inventory-go:stacks"
  "${PREFIX}/stacks-kafka-analytics-python:stacks"
  "${PREFIX}/stacks-kafka-relay-nodejs:stacks"
  "${PREFIX}/stacks-postgres-users-go:stacks"
  "${PREFIX}/stacks-postgres-orders-python:stacks"
  "${PREFIX}/stacks-postgres-billing-java:stacks"
  "${PREFIX}/stacks-postgres-audit-go:stacks"
)

build() {
  echo "==> Building stacks-gateway + 12 stack apps..."
  docker build -f gateway/Dockerfile -t "${IMAGES[0]}" .
  docker build -f redis-stack/session-python/Dockerfile -t "${IMAGES[1]}" .
  docker build -f redis-stack/cache-go/Dockerfile -t "${IMAGES[2]}" .
  docker build -f redis-stack/notifier-java/Dockerfile -t "${IMAGES[3]}" .
  docker build -f redis-stack/worker-nodejs/Dockerfile -t "${IMAGES[4]}" .
  docker build -f kafka-stack/processor-java/Dockerfile -t "${IMAGES[5]}" .
  docker build -f kafka-stack/inventory-go/Dockerfile -t "${IMAGES[6]}" .
  docker build -f kafka-stack/analytics-python/Dockerfile -t "${IMAGES[7]}" .
  docker build -f kafka-stack/relay-nodejs/Dockerfile -t "${IMAGES[8]}" .
  docker build -f postgres-stack/users-go/Dockerfile -t "${IMAGES[9]}" .
  docker build -f postgres-stack/orders-python/Dockerfile -t "${IMAGES[10]}" .
  docker build -f postgres-stack/billing-java/Dockerfile -t "${IMAGES[11]}" .
  docker build -f postgres-stack/audit-go/Dockerfile -t "${IMAGES[12]}" .
  echo "==> Done building"
}

load_to_kind() {
  for img in "${IMAGES[@]}"; do
    echo "==> kind load ${img}"
    kind load docker-image "$img"
  done
}

apply() {
  for ns in stacks stacks-redis stacks-kafka stacks-postgres; do
    kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
  done
  kubectl apply -f k8s/gateway.yaml
  kubectl apply -n stacks-redis -f k8s/redis-stack.yaml
  kubectl apply -n stacks-kafka -f k8s/kafka-stack.yaml
  kubectl apply -n stacks-postgres -f k8s/postgres-stack.yaml
  kubectl apply -f k8s/odigos-instrument.yaml
}

rollout() {
  echo "==> Waiting for stacks-gateway..."
  kubectl rollout status deployment/stacks-gateway -n stacks --timeout=180s
  echo "==> Waiting for redis stack..."
  kubectl rollout status deployment/redis deployment/session-python deployment/cache-go \
    deployment/notifier-java deployment/worker-nodejs -n stacks-redis --timeout=180s
  echo "==> Waiting for kafka stack..."
  kubectl rollout status deployment/kafka-broker deployment/processor-java deployment/inventory-go \
    deployment/analytics-python deployment/relay-nodejs -n stacks-kafka --timeout=240s
  echo "==> Waiting for postgres stack..."
  kubectl rollout status deployment/postgres deployment/users-go deployment/orders-python \
    deployment/billing-java deployment/audit-go -n stacks-postgres --timeout=180s
}

deploy() {
  build
  load_to_kind
  apply
  rollout
  echo ""
  echo "Deployed: stacks-gateway + 3 stacks (12 apps)"
  echo "  Gateway:  stacks/stacks-gateway — 3 transactions"
  echo "  Trigger:  make trigger-traffic"
}

trigger_traffic() {
  local replicas="${TRAFFIC_REPLICAS:-10}"
  local duration="${TRAFFIC_DURATION_SECONDS:-3600}"
  local parallel="${TRAFFIC_PARALLEL:-3}"
  kubectl delete job stacks-traffic -n stacks --ignore-not-found=true
  kubectl delete deployment stacks-traffic -n stacks --ignore-not-found=true
  sed \
    -e "s/replicas: 10/replicas: ${replicas}/" \
    -e "s/value: \"3600\"/value: \"${duration}\"/" \
    -e "s/value: \"3\"/value: \"${parallel}\"/" \
    k8s/traffic-deployment.yaml | kubectl apply -f -
  echo ""
  echo "BOOM → stacks-gateway (place-order | sync-catalog | fulfill-shipment)"
  echo "Stop: make stop-traffic"
}

stop_traffic() {
  kubectl delete deployment stacks-traffic -n stacks --ignore-not-found=true
  kubectl delete job stacks-traffic -n stacks --ignore-not-found=true
  echo "Traffic stopped."
}

status() {
  echo "=== stacks ==="
  kubectl get pods,svc -n stacks
  for ns in stacks-redis stacks-kafka stacks-postgres; do
    echo "=== $ns ==="
    kubectl get pods,svc -n "$ns"
  done
}

clean() {
  for ns in stacks stacks-redis stacks-kafka stacks-postgres; do
    kubectl delete namespace "$ns" --ignore-not-found=true
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
  *) echo "Usage: $0 {build|load-to-kind|apply|rollout|deploy|traffic|stop-traffic|status|clean}"; exit 1 ;;
esac
