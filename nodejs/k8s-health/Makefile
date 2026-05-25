NAMESPACE := nodejs-k8s-health
IMAGE := ghcr.io/odigos-io/synthetic-apps/nodejs-k8s-health:k8s-health
DEPLOYMENTS := ready-fail-probe-fast ready-fail-probe-slow live-ready-fail crash-exit invalid-image unschedulable-resources

.PHONY: build
build:
	docker build -f deployments/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply
apply:
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@for d in $(DEPLOYMENTS); do \
		kubectl apply -n $(NAMESPACE) -f deployments/$$d/k8s.yaml; \
		kubectl apply -n $(NAMESPACE) -f deployments/$$d/odigos-instrument.yaml; \
	done

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply

.PHONY: status
status:
	kubectl get pods -n $(NAMESPACE) -o wide
	kubectl get deployments -n $(NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
