include depot.mk

.PHONY: check-chainsaw test-runtime-version test-runtime-versions test-tail-sampling test-url-templatization test-head-sampling-grpc test-head-sampling-http test-rollout test-pii-masking test-sql-query

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

# Assumes a kind cluster with Odigos already installed at the version under test.
# Usage: make test-tail-sampling LANGUAGE=nodejs|python|java
# Usage: make test-tail-sampling LANGUAGE=java OTEL_DISTRO_NAME=opentelemetry-ebpf-instrumentation
# Usage: make test-head-sampling-http LANGUAGE=nodejs
# Usage: make test-head-sampling-grpc LANGUAGE=nodejs
# Usage: make test-runtime-versions LANGUAGE=nodejs|python|java|golang
LANGUAGE ?= nodejs
OTEL_DISTRO_NAME ?=

test-tail-sampling: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs python java)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs python java" && exit 1)
	chainsaw test scenarios/tail-sampling/test \
		--set-string language=$(LANGUAGE) \
		--set-string depot_pull_token=$${DEPOT_SYNTHTIC_APPS_PULL_TOKEN:-} \
		--set-string otel_distro_name=$(OTEL_DISTRO_NAME)

test-head-sampling-http: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs python java)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs python java" && exit 1)
	chainsaw test scenarios/head-sampling-http/test \
		--set-string language=$(LANGUAGE) \
		--set-string depot_pull_token=$${DEPOT_SYNTHTIC_APPS_PULL_TOKEN:-} \
		--set-string otel_distro_name=$(OTEL_DISTRO_NAME)

test-runtime-versions: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs python java golang)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs python java golang" && exit 1)
	chainsaw test scenarios/runtime-versions/test \
		--set-string language=$(LANGUAGE) \
		--set-string depot_pull_token=$${DEPOT_SYNTHTIC_APPS_PULL_TOKEN:-} \
		--set-string otel_distro_name=$(OTEL_DISTRO_NAME)

# Usage: make test-url-templatization LANGUAGE=nodejs
# Assumes a kind cluster with Odigos already installed at the version under test.
test-url-templatization: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs" && exit 1)
	chainsaw test scenarios/url-templatization/test \
		--set-string language=$(LANGUAGE) \
		--set-string depot_pull_token=$${DEPOT_SYNTHTIC_APPS_PULL_TOKEN:-} \
		--set-string otel_distro_name=$(OTEL_DISTRO_NAME)

# Assumes a kind cluster with Odigos already installed at the version under test.
# Usage: make test-head-sampling-grpc LANGUAGE=nodejs
test-head-sampling-grpc: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs" && exit 1)
	@if [ -n "$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN" ]; then \
		chainsaw test tests/head-sampling-grpc --set-string language=$(LANGUAGE) --set-string depot_pull_token=$$DEPOT_SYNTHTIC_APPS_PULL_TOKEN; \
	else \
		chainsaw test tests/head-sampling-grpc --set-string language=$(LANGUAGE); \
	fi

# Usage: make test-rollout LANGUAGE=nodejs
# Assumes a kind cluster with Odigos already installed at the version under test.
test-rollout: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs" && exit 1)
	chainsaw test scenarios/rollout/test \
		--set-string language=$(LANGUAGE) \
		--set-string depot_pull_token=$${DEPOT_SYNTHTIC_APPS_PULL_TOKEN:-} \
		--set-string otel_distro_name=$(OTEL_DISTRO_NAME)

# Usage: make test-pii-masking LANGUAGE=nodejs
# Assumes a kind cluster with Odigos already installed at the version under test.
test-pii-masking: check-chainsaw
	@test "$(filter $(LANGUAGE),nodejs)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs" && exit 1)
	chainsaw test scenarios/pii-masking/test \
		--set-string language=$(LANGUAGE) \
		--set-string depot_pull_token=$${DEPOT_SYNTHTIC_APPS_PULL_TOKEN:-} \
		--set-string otel_distro_name=$(OTEL_DISTRO_NAME)

# Usage: make test-sql-query LANGUAGE=golang
# Assumes a kind cluster with Odigos already installed at the version under test.
test-sql-query: check-chainsaw
	@test "$(filter $(LANGUAGE),golang)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: golang" && exit 1)
	chainsaw test scenarios/sql-query/test \
		--set-string language=$(LANGUAGE) \
		--set-string depot_pull_token=$${DEPOT_SYNTHTIC_APPS_PULL_TOKEN:-} \
		--set-string otel_distro_name=$(OTEL_DISTRO_NAME)
