ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
PREFIX := ghcr.io/odigos-io/synthetic-apps

.PHONY: build load-to-kind apply rollout deploy status clean trigger-traffic trigger-traffic-burst stop-traffic traffic-status

TRAFFIC_REPLICAS ?= 10
TRAFFIC_DURATION_SECONDS ?= 3600
TRAFFIC_PARALLEL ?= 3
TRAFFIC_ITERATIONS ?= 500
TRAFFIC_WORKERS ?= 10

build:
	docker build -f gateway/Dockerfile -t $(PREFIX)/stacks-gateway:stacks .
	docker build -f redis-stack/session-python/Dockerfile -t $(PREFIX)/stacks-redis-session-python:stacks .
	docker build -f redis-stack/cache-go/Dockerfile -t $(PREFIX)/stacks-redis-cache-go:stacks .
	docker build -f redis-stack/notifier-java/Dockerfile -t $(PREFIX)/stacks-redis-notifier-java:stacks .
	docker build -f redis-stack/worker-nodejs/Dockerfile -t $(PREFIX)/stacks-redis-worker-nodejs:stacks .
	docker build -f kafka-stack/processor-java/Dockerfile -t $(PREFIX)/stacks-kafka-processor-java:stacks .
	docker build -f kafka-stack/inventory-go/Dockerfile -t $(PREFIX)/stacks-kafka-inventory-go:stacks .
	docker build -f kafka-stack/analytics-python/Dockerfile -t $(PREFIX)/stacks-kafka-analytics-python:stacks .
	docker build -f kafka-stack/relay-nodejs/Dockerfile -t $(PREFIX)/stacks-kafka-relay-nodejs:stacks .
	docker build -f postgres-stack/users-go/Dockerfile -t $(PREFIX)/stacks-postgres-users-go:stacks .
	docker build -f postgres-stack/orders-python/Dockerfile -t $(PREFIX)/stacks-postgres-orders-python:stacks .
	docker build -f postgres-stack/billing-java/Dockerfile -t $(PREFIX)/stacks-postgres-billing-java:stacks .
	docker build -f postgres-stack/audit-go/Dockerfile -t $(PREFIX)/stacks-postgres-audit-go:stacks .

load-to-kind:
	kind load docker-image $(PREFIX)/stacks-gateway:stacks
	kind load docker-image $(PREFIX)/stacks-redis-session-python:stacks
	kind load docker-image $(PREFIX)/stacks-redis-cache-go:stacks
	kind load docker-image $(PREFIX)/stacks-redis-notifier-java:stacks
	kind load docker-image $(PREFIX)/stacks-redis-worker-nodejs:stacks
	kind load docker-image $(PREFIX)/stacks-kafka-processor-java:stacks
	kind load docker-image $(PREFIX)/stacks-kafka-inventory-go:stacks
	kind load docker-image $(PREFIX)/stacks-kafka-analytics-python:stacks
	kind load docker-image $(PREFIX)/stacks-kafka-relay-nodejs:stacks
	kind load docker-image $(PREFIX)/stacks-postgres-users-go:stacks
	kind load docker-image $(PREFIX)/stacks-postgres-orders-python:stacks
	kind load docker-image $(PREFIX)/stacks-postgres-billing-java:stacks
	kind load docker-image $(PREFIX)/stacks-postgres-audit-go:stacks

apply:
	kubectl create namespace stacks --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace stacks-redis --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace stacks-kafka --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace stacks-postgres --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -f k8s/gateway.yaml
	kubectl apply -n stacks-redis -f k8s/redis-stack.yaml
	kubectl apply -n stacks-kafka -f k8s/kafka-stack.yaml
	kubectl apply -n stacks-postgres -f k8s/postgres-stack.yaml
	kubectl apply -f k8s/odigos-instrument.yaml

rollout:
	kubectl rollout status deployment/stacks-gateway -n stacks --timeout=180s
	kubectl rollout status deployment/redis deployment/session-python deployment/cache-go deployment/notifier-java deployment/worker-nodejs -n stacks-redis --timeout=180s
	kubectl rollout status deployment/kafka-broker deployment/processor-java deployment/inventory-go deployment/analytics-python deployment/relay-nodejs -n stacks-kafka --timeout=240s
	kubectl rollout status deployment/postgres deployment/users-go deployment/orders-python deployment/billing-java deployment/audit-go -n stacks-postgres --timeout=180s

deploy: build load-to-kind apply rollout

status:
	@echo "=== stacks (gateway) ==="
	@kubectl get pods,svc -n stacks
	@for ns in stacks-redis stacks-kafka stacks-postgres; do \
		echo "=== $$ns ==="; \
		kubectl get pods,svc -n $$ns; \
	done

trigger-traffic:
	kubectl delete job stacks-traffic -n stacks --ignore-not-found=true
	kubectl delete deployment stacks-traffic -n stacks --ignore-not-found=true
	sed \
		-e 's/replicas: 10/replicas: $(TRAFFIC_REPLICAS)/' \
		-e 's/value: "3600"/value: "$(TRAFFIC_DURATION_SECONDS)"/' \
		-e 's/value: "3"/value: "$(TRAFFIC_PARALLEL)"/' \
		k8s/traffic-deployment.yaml | kubectl apply -f -
	@echo ""
	@echo "BOOM traffic → stacks-gateway (3 transactions):"
	@echo "  POST /transactions/place-order"
	@echo "  POST /transactions/sync-catalog"
	@echo "  POST /transactions/fulfill-shipment"
	@echo "  replicas=$(TRAFFIC_REPLICAS)  parallel=$(TRAFFIC_PARALLEL)  duration=$(TRAFFIC_DURATION_SECONDS)s"
	@echo "  Stop: make stop-traffic"

trigger-traffic-burst:
	kubectl delete deployment stacks-traffic -n stacks --ignore-not-found=true
	kubectl delete job stacks-traffic -n stacks --ignore-not-found=true
	sed 's/value: "500"/value: "$(TRAFFIC_ITERATIONS)"/; s/value: "10"/value: "$(TRAFFIC_WORKERS)"/' k8s/traffic-job.yaml | kubectl apply -f -
	kubectl wait --for=condition=complete job/stacks-traffic -n stacks --timeout=1800s || \
		(kubectl logs job/stacks-traffic -n stacks --tail=50; exit 1)
	@kubectl logs job/stacks-traffic -n stacks | tail -10

stop-traffic:
	kubectl delete deployment stacks-traffic -n stacks --ignore-not-found=true
	kubectl delete job stacks-traffic -n stacks --ignore-not-found=true
	@echo "Traffic stopped."

traffic-status:
	@kubectl get pods -n stacks -l app=stacks-traffic 2>/dev/null || echo "No traffic pods running"
	@kubectl logs -n stacks -l app=stacks-traffic --tail=3 2>/dev/null | tail -6 || true

clean:
	kubectl delete namespace stacks stacks-redis stacks-kafka stacks-postgres --ignore-not-found=true
