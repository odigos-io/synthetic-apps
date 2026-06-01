NAMESPACE := nodejs-agent-stability
IMAGE := ghcr.io/odigos-io/synthetic-apps/nodejs-agent-stability:agent-stability
DEPLOYMENTS := starts-after-instrumentation crash-on-odigos-immediate crash-on-odigos-delayed partial-instrumentation

.PHONY: build load-to-kind apply deploy status clean
build:
	docker build -f deployments/Dockerfile -t $(IMAGE) .

load-to-kind:
	kind load docker-image $(IMAGE)

apply:
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@for d in $(DEPLOYMENTS); do \
		kubectl apply -n $(NAMESPACE) -f deployments/$$d/k8s.yaml; \
		kubectl apply -n $(NAMESPACE) -f deployments/$$d/odigos-instrument.yaml; \
	done

deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply

status:
	kubectl get pods -n $(NAMESPACE) -o wide
	kubectl get deployments -n $(NAMESPACE)

clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
