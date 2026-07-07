NAMESPACE ?= nodejs-url-templatization

include ../../../depot.mk
include ../scenario.mk

IMAGE := $(DEPOT_REGISTRY)/synthetic-apps:nodejs-url-templatization

.PHONY: build
build:
	docker build -f deployments/url-templatization/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply
apply: ensure-namespace
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization/k8s.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization-disabled/k8s.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization-skip-status-codes/k8s.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization-rules/k8s.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization-rules-merge/k8s.yaml
	$(MAKE) apply-odigos-sources
	kubectl apply -n odigos-system -f deployments/url-templatization/url-templatization-action.yaml
	kubectl apply -n odigos-system -f deployments/url-templatization-disabled/url-templatization-disabled-action.yaml
	kubectl apply -n odigos-system -f deployments/url-templatization-skip-status-codes/skip-status-codes-actions.yaml
	kubectl apply -n odigos-system -f deployments/url-templatization-rules/rules-action.yaml
	kubectl apply -n odigos-system -f deployments/url-templatization-rules-merge/rules-merge-actions.yaml

.PHONY: rollout
rollout:
	kubectl rollout restart deployment/url-templatization deployment/url-templatization-disabled deployment/url-templatization-skip-status-codes deployment/url-templatization-rules deployment/url-templatization-rules-merge -n $(NAMESPACE)
	kubectl rollout status deployment/url-templatization -n $(NAMESPACE) --timeout=120s
	kubectl rollout status deployment/url-templatization-disabled -n $(NAMESPACE) --timeout=120s
	kubectl rollout status deployment/url-templatization-skip-status-codes -n $(NAMESPACE) --timeout=120s
	kubectl rollout status deployment/url-templatization-rules -n $(NAMESPACE) --timeout=120s
	kubectl rollout status deployment/url-templatization-rules-merge -n $(NAMESPACE) --timeout=120s

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply
	make rollout

.PHONY: status
status:
	kubectl get pods -n $(NAMESPACE) -o wide
	kubectl get deployments -n $(NAMESPACE)

.PHONY: call-endpoints
call-endpoints:
	./scripts/call-endpoints.sh

# Deletes any prior run and creates a fresh Job that curls url-templatization endpoints in-cluster.
.PHONY: trigger trigger-url-templatization-curls
trigger: trigger-url-templatization-curls

trigger-url-templatization-curls: ensure-namespace
	kubectl delete job url-templatization-curls -n $(NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(NAMESPACE) -f deployments/url-templatization/curl-job.yaml
	kubectl wait --for=condition=complete job/url-templatization-curls -n $(NAMESPACE) --timeout=300s || \
		(kubectl logs job/url-templatization-curls -n $(NAMESPACE) --tail=200; exit 1)
	kubectl logs job/url-templatization-curls -n $(NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/url-templatization/url-templatization-action.yaml --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/url-templatization-disabled/url-templatization-disabled-action.yaml --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/url-templatization-skip-status-codes/skip-status-codes-actions.yaml --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/url-templatization-rules/rules-action.yaml --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/url-templatization-rules-merge/rules-merge-actions.yaml --ignore-not-found=true
