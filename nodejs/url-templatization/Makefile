NAMESPACE := nodejs-url-templatization
IMAGE := ghcr.io/odigos-io/synthetic-apps/nodejs-url-templatization:url-templatization

.PHONY: build
build:
	docker build -f deployments/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply
apply:
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization/k8s.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization/odigos-instrument.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization-disabled/k8s.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization-disabled/odigos-instrument.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization-multi-rules/k8s.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization-multi-rules/odigos-instrument.yaml
	kubectl apply -n odigos-system -f deployments/url-templatization/url-templatization-action.yaml
	kubectl apply -n odigos-system -f deployments/url-templatization-disabled/url-templatization-disabled-action.yaml
	kubectl apply -n odigos-system -f deployments/url-templatization-multi-rules/multi-rules-actions.yaml

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply

.PHONY: status
status:
	kubectl get pods -n $(NAMESPACE) -o wide
	kubectl get deployments -n $(NAMESPACE)

.PHONY: call-endpoints
call-endpoints:
	./scripts/call-endpoints.sh

# Deletes any prior run and creates a fresh Job that curls url-templatization endpoints in-cluster.
.PHONY: trigger-url-templatization-curls
trigger-url-templatization-curls:
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job url-templatization-curls -n $(NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization/curl-job.yaml
	kubectl wait --for=condition=complete job/url-templatization-curls -n $(NAMESPACE) --timeout=300s || \
		(kubectl logs job/url-templatization-curls -n $(NAMESPACE) --tail=200; exit 1)
	kubectl logs job/url-templatization-curls -n $(NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
