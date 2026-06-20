DEPOT_REGISTRY ?= p0xd21zf5r.registry.depot.dev
DEPOT_PULL_SECRET_NAME ?= regcred

.PHONY: ensure-namespace setup-depot-registry-auth

ensure-namespace:
ifndef NAMESPACE
	$(error NAMESPACE is required)
endif
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@if [ -n "$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN" ]; then \
		$(MAKE) setup-depot-registry-auth NAMESPACE=$(NAMESPACE); \
	fi

setup-depot-registry-auth:
ifndef NAMESPACE
	$(error NAMESPACE is required)
endif
	@set -e; \
	if [ -z "$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN" ]; then \
		echo "DEPOT_SYNTHTIC_APPS_PULL_TOKEN not set" >&2; \
		exit 1; \
	fi; \
	kubectl create secret docker-registry $(DEPOT_PULL_SECRET_NAME) \
		--namespace=$(NAMESPACE) \
		--docker-server=$(DEPOT_REGISTRY) \
		--docker-username=x-token \
		--docker-password="$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN" \
		--dry-run=client -o yaml | kubectl apply -f -; \
	kubectl patch serviceaccount default \
		--namespace=$(NAMESPACE) \
		--type merge \
		-p '{"imagePullSecrets": [{"name": "$(DEPOT_PULL_SECRET_NAME)"}]}'
