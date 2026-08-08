CLUSTER_NAME ?= kind
KIND_CONFIG ?= kind-config.yaml
# Release tag, e.g. v1.2.3 or v1.1.1-rc1 (leading "v" is optional).
TAG ?=
TIER ?=

# Enterprise CI workflow run id used to resolve Depot image tags.
GITHUB_RUN_ID ?=
GITHUB_REPOSITORY_NAME ?= odigos-enterprise
DEPOT_ORG_ID ?= p0xd21zf5r
DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID ?= w8zkfqwtt3
DEPOT_ODIGLET_ENTERPRISE_REGISTRY_ID ?= 1wj57h6qh9
DEPOT_ODIGOS_OSS_REGISTRY_ID ?= 570xmd9kld
DEPOT_REGISTRY ?= $(DEPOT_ORG_ID).registry.depot.dev
DEPOT_PULL_SECRET_NAME ?= depot-regcred
ODIGOS_NAMESPACE ?= odigos-system

CI_IMAGES_VALUES ?= odigos-ci-images.values.yaml
# Optional path passed to helm -f. Defaults to CI_IMAGES_VALUES when that file exists.
VALUES_FILE ?=

ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/..)
INSTALL_ODIGOS_SCRIPT := $(ROOT_DIR)/.github/scripts/install-odigos-helm.sh
GENERATE_CI_IMAGES_SCRIPT := $(dir $(lastword $(MAKEFILE_LIST)))generate-odigos-ci-images-values.sh
SETUP_DEPOT_AUTH_SCRIPT := $(dir $(lastword $(MAKEFILE_LIST)))setup-depot-registry-auth.sh

.PHONY: create-cluster delete-cluster generate-ci-images-values setup-depot-auth install-odigos

# Create a kind cluster for local scenario development/testing.
# Usage: make -C tests create-cluster
#        make -C tests create-cluster CLUSTER_NAME=synthetic
create-cluster:
	@command -v kind >/dev/null 2>&1 || { \
		echo "Error: kind is not installed or not in PATH."; \
		echo "Install: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"; \
		exit 1; \
	}
	@if kind get clusters 2>/dev/null | grep -qx "$(CLUSTER_NAME)"; then \
		echo "Cluster '$(CLUSTER_NAME)' already exists."; \
		echo "Delete it first with: make -C tests delete-cluster CLUSTER_NAME=$(CLUSTER_NAME)"; \
		exit 1; \
	fi
	kind create cluster --name "$(CLUSTER_NAME)" --config "$(KIND_CONFIG)"

delete-cluster:
	kind delete cluster --name "$(CLUSTER_NAME)"

# Mint a Depot pull token via CLI and create an imagePullSecret in the cluster.
# Requires: depot login (uses depot pull-token --project <enterprise-registry-id>).
# Usage: make -C tests setup-depot-auth
setup-depot-auth:
	@DEPOT_ORG_ID="$(DEPOT_ORG_ID)" \
		DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID="$(DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID)" \
		DEPOT_REGISTRY="$(DEPOT_REGISTRY)" \
		DEPOT_PULL_SECRET_NAME="$(DEPOT_PULL_SECRET_NAME)" \
		"$(SETUP_DEPOT_AUTH_SCRIPT)" "$(ODIGOS_NAMESPACE)"

# Generate Helm values that override component images with Depot CI builds
# (enterprise, odiglet, and OSS registries).
# Usage: make -C tests generate-ci-images-values GITHUB_RUN_ID=1658821493
generate-ci-images-values:
	@test -n "$(GITHUB_RUN_ID)" || { \
		echo "Error: GITHUB_RUN_ID is required."; \
		echo "Usage: make -C tests generate-ci-images-values GITHUB_RUN_ID=<enterprise-ci-run-id>"; \
		exit 1; \
	}
	@GITHUB_REPOSITORY_NAME="$(GITHUB_REPOSITORY_NAME)" \
		DEPOT_ORG_ID="$(DEPOT_ORG_ID)" \
		DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID="$(DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID)" \
		DEPOT_ODIGLET_ENTERPRISE_REGISTRY_ID="$(DEPOT_ODIGLET_ENTERPRISE_REGISTRY_ID)" \
		DEPOT_ODIGOS_OSS_REGISTRY_ID="$(DEPOT_ODIGOS_OSS_REGISTRY_ID)" \
		DEPOT_PULL_SECRET_NAME="$(DEPOT_PULL_SECRET_NAME)" \
		"$(GENERATE_CI_IMAGES_SCRIPT)" "$(GITHUB_RUN_ID)" "$(CI_IMAGES_VALUES)"

# Install Odigos via Helm.
# Usage: make -C tests install-odigos TAG=v1.2.3
#        make -C tests install-odigos GITHUB_RUN_ID=1658821493
# With GITHUB_RUN_ID: mints Depot pull secret, generates image overrides for
# enterprise/odiglet/OSS components, and installs (TAG defaults to e2e-test → latest chart).
# If TIER is unset: enterprise when ODIGOS_ONPREM_TOKEN is set, otherwise oss.
install-odigos:
	@command -v helm >/dev/null 2>&1 || { \
		echo "Error: helm is not installed or not in PATH."; \
		echo "Install: https://helm.sh/docs/intro/install/"; \
		exit 1; \
	}
	@if [ -z "$(TAG)" ] && [ -z "$(GITHUB_RUN_ID)" ]; then \
		echo "Error: provide TAG and/or GITHUB_RUN_ID."; \
		echo "  make -C tests install-odigos TAG=v1.2.3"; \
		echo "  make -C tests install-odigos GITHUB_RUN_ID=<enterprise-ci-run-id>"; \
		exit 1; \
	fi
	@if [ -n "$(GITHUB_RUN_ID)" ]; then \
		$(MAKE) setup-depot-auth; \
		$(MAKE) generate-ci-images-values GITHUB_RUN_ID="$(GITHUB_RUN_ID)"; \
	fi
	@tag="$(TAG)"; \
	if [ -z "$$tag" ]; then tag=e2e-test; fi; \
	values_file="$(VALUES_FILE)"; \
	if [ -z "$$values_file" ] && [ -f "$(CI_IMAGES_VALUES)" ]; then \
		values_file="$(CI_IMAGES_VALUES)"; \
	fi; \
	tier="$(TIER)"; \
	if [ -z "$$tier" ]; then \
		if [ -n "$${ODIGOS_ONPREM_TOKEN:-}" ]; then tier=enterprise; else tier=oss; fi; \
	fi; \
	if [ -n "$$values_file" ]; then \
		HELM_VALUES_FILE="$$values_file" "$(INSTALL_ODIGOS_SCRIPT)" "$$tag" "$$tier"; \
	else \
		"$(INSTALL_ODIGOS_SCRIPT)" "$$tag" "$$tier"; \
	fi
