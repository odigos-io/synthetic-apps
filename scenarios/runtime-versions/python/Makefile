NAMESPACE ?= python-runtime-versions
LANG := python

include ../../../depot.mk
include ../scenario.mk

VERSION_VARIANTS := versionlatest versionminimum versionminimumlegacy versionunsupported versionveryold

IMAGE_PREFIX := $(DEPOT_REGISTRY)/synthetic-apps:$(LANG)-runtime-versions

.PHONY: build
build:
	$(foreach variant,$(VERSION_VARIANTS),docker build -f deployments/$(variant)/Dockerfile -t $(IMAGE_PREFIX)-$(variant) .;)

.PHONY: load-to-kind
load-to-kind:
	$(foreach variant,$(VERSION_VARIANTS),kind load docker-image $(IMAGE_PREFIX)-$(variant);)

.PHONY: apply
apply:
	$(MAKE) ensure-namespace NAMESPACE=python-runtime-versions
	$(foreach variant,$(VERSION_VARIANTS),kubectl apply -n python-runtime-versions -f deployments/$(variant)/k8s.yaml;)
	$(MAKE) apply-odigos-sources

.PHONY: rollout
rollout:
	kubectl rollout restart $(foreach variant,$(VERSION_VARIANTS),deployment/$(variant) ) -n python-runtime-versions
	$(foreach variant,$(VERSION_VARIANTS),kubectl rollout status deployment/$(variant) -n python-runtime-versions --timeout=120s;)

.PHONY: deploy
deploy:
	echo "error here to test that it's not called from CI"
	exit 1
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply

.PHONY: status
status:
	kubectl get pods -n python-runtime-versions
	kubectl get services -n python-runtime-versions

.PHONY: clean
clean:
	kubectl delete namespace python-runtime-versions --ignore-not-found=true
