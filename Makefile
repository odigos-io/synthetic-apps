include depot.mk

.PHONY: check-chainsaw test-runtime-version test-tail-sampling test-url-templatization test-head-sampling-grpc test-head-sampling-http

check-chainsaw:
	@command -v chainsaw >/dev/null 2>&1 || { \
		echo "Error: chainsaw is not installed or not in PATH."; \
		echo ""; \
		echo "Install chainsaw: https://kyverno.github.io/chainsaw/0.2.3/quick-start/install/"; \
		echo ""; \
		echo "  Homebrew:"; \
		echo "    brew tap kyverno/chainsaw https://github.com/kyverno/chainsaw"; \
		echo "    brew install kyverno/chainsaw/chainsaw"; \
		echo ""; \
		echo "  Go:"; \
		echo "    go install github.com/kyverno/chainsaw@latest"; \
		echo ""; \
		echo "  Manual: download a pre-compiled binary from the releases page"; \
		exit 1; \
	}

test-runtime-version: check-chainsaw
	kind delete cluster --name test-versions
	kind create cluster --name test-versions --config tests/kind-config.yaml
	chainsaw test tests/runtime-version

# Assumes a kind cluster with Odigos already installed at the version under test.
# Usage: make test-tail-sampling LANGUAGE=nodejs
# Usage: make test-head-sampling-http LANGUAGE=nodejs
# Usage: make test-head-sampling-grpc LANGUAGE=nodejs
LANGUAGE ?= nodejs

test-tail-sampling: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs" && exit 1)
	@echo "language: $(LANGUAGE)" | chainsaw test tests/tail-sampling --values -

test-head-sampling-http: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs python java)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs python java" && exit 1)
	@if [ -n "$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN" ]; then \
		chainsaw test tests/head-sampling-http --set-string language=$(LANGUAGE) --set-string depot_pull_token=$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN; \
	else \
		chainsaw test tests/head-sampling-http --set-string language=$(LANGUAGE); \
	fi

# Assumes a kind cluster with Odigos already installed at the version under test.
test-url-templatization: check-chainsaw
	chainsaw test tests/url-templatization

# Assumes a kind cluster with Odigos already installed at the version under test.
# Usage: make test-head-sampling-grpc LANGUAGE=nodejs
test-head-sampling-grpc: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs" && exit 1)
	@if [ -n "$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN" ]; then \
		chainsaw test tests/head-sampling-grpc --set-string language=$(LANGUAGE) --set-string depot_pull_token=$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN; \
	else \
		chainsaw test tests/head-sampling-grpc --set-string language=$(LANGUAGE); \
	fi
