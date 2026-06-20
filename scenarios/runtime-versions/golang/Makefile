NAMESPACE ?= golang-runtime-versions
LANG := golang

include ../../../depot.mk
include ../scenario.mk

IMAGE_PREFIX := $(DEPOT_REGISTRY)/synthetic-apps:$(LANG)-runtime-versions

.PHONY: build
build:
	$(foreach variant,$(VERSION_VARIANTS),docker build -f deployments/$(variant)/Dockerfile -t $(IMAGE_PREFIX)-$(variant) .;)

.PHONY: load-to-kind
load-to-kind:
	$(foreach variant,$(VERSION_VARIANTS),kind load docker-image $(IMAGE_PREFIX)-$(variant);)

.PHONY: apply
apply:
	$(MAKE) ensure-namespace NAMESPACE=golang-runtime-versions
	$(foreach variant,$(VERSION_VARIANTS),kubectl apply -n golang-runtime-versions -f deployments/$(variant)/k8s.yaml;)
	$(MAKE) apply-odigos-sources

.PHONY: rollout
rollout:
	kubectl rollout restart $(foreach variant,$(VERSION_VARIANTS),deployment/$(variant) ) -n golang-runtime-versions
	$(foreach variant,$(VERSION_VARIANTS),kubectl rollout status deployment/$(variant) -n golang-runtime-versions --timeout=120s;)

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) rollout

.PHONY: status
status:
	kubectl get pods -n golang-runtime-versions
	kubectl get services -n golang-runtime-versions

.PHONY: clean
clean:
	kubectl delete namespace golang-runtime-versions --ignore-not-found=true
