NAMESPACE ?= python-pii-masking

include ../../../depot.mk
include ../scenario.mk

IMAGE := $(DEPOT_REGISTRY)/synthetic-apps:python-pii-masking

.PHONY: build
build:
	docker build -f deployments/pii-masking/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply
apply: ensure-namespace
	kubectl apply -n $(NAMESPACE) -f deployments/pii-masking/k8s.yaml
	$(MAKE) apply-odigos-sources
	$(MAKE) apply-action

.PHONY: apply-action
apply-action:
	kubectl apply -n odigos-system -f deployments/pii-masking/pii-masking-action.yaml

.PHONY: rollout
rollout:
	kubectl rollout restart deployment/pii-masking -n $(NAMESPACE)
	kubectl rollout status deployment/pii-masking -n $(NAMESPACE) --timeout=120s

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) rollout

.PHONY: status
status:
	kubectl get pods -n $(NAMESPACE) -o wide
	kubectl get deployments -n $(NAMESPACE)
	kubectl get services -n $(NAMESPACE)

# Deletes any prior run and creates a fresh Job that hits /span/* endpoints.
.PHONY: trigger trigger-pii-masking-curls
trigger: trigger-pii-masking-curls

trigger-pii-masking-curls: ensure-namespace
	kubectl delete job pii-masking-curls -n $(NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(NAMESPACE) -f deployments/pii-masking/curl-job.yaml
	kubectl wait --for=condition=complete job/pii-masking-curls -n $(NAMESPACE) --timeout=180s || \
		(kubectl logs job/pii-masking-curls -n $(NAMESPACE) --tail=200; exit 1)
	kubectl logs job/pii-masking-curls -n $(NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/pii-masking/pii-masking-action.yaml --ignore-not-found=true
