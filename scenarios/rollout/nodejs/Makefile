NAMESPACE ?= nodejs-rollout
DEPLOYMENTS := no-pods in-rollout auto-rollout-disabled blocking-rollout queued-rollout

include ../../../depot.mk
include ../scenario.mk

IMAGE := $(DEPOT_REGISTRY)/synthetic-apps:nodejs-rollout

.PHONY: build
build:
	docker build -f deployments/no-pods/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply-workload
apply-workload: ensure-namespace
ifndef DEPLOYMENT
	$(error DEPLOYMENT is required (e.g. DEPLOYMENT=in-rollout))
endif
	kubectl apply -n $(NAMESPACE) -f deployments/$(DEPLOYMENT)/k8s.yaml

.PHONY: apply-deployment
apply-deployment: ensure-namespace
ifndef DEPLOYMENT
	$(error DEPLOYMENT is required (e.g. DEPLOYMENT=no-pods))
endif
	$(MAKE) apply-workload DEPLOYMENT=$(DEPLOYMENT) NAMESPACE=$(NAMESPACE)
	kubectl apply -f deployments/$(DEPLOYMENT)/odigos-instrument.yaml

.PHONY: apply
apply: ensure-namespace
	@$(foreach d,$(DEPLOYMENTS),$(MAKE) apply-deployment DEPLOYMENT=$(d);)

.PHONY: apply-nop-destination
apply-nop-destination:
	kubectl apply -f deployments/nop-destination.yaml

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) apply-nop-destination

.PHONY: no-pods-scale-up
no-pods-scale-up:
	kubectl scale deployment/no-pods -n $(NAMESPACE) --replicas=1
	kubectl rollout status deployment/no-pods -n $(NAMESPACE) --timeout=120s

.PHONY: no-pods-scale-0
no-pods-scale-0:
	kubectl scale deployment/no-pods -n $(NAMESPACE) --replicas=0

.PHONY: status
status:
	kubectl get pods -n $(NAMESPACE)
	kubectl get deployments -n $(NAMESPACE)
	kubectl get services -n $(NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
	kubectl delete -f deployments/nop-destination.yaml --ignore-not-found=true
