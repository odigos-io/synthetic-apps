CHAINSAW_VERSION ?= v0.2.12

include depot.mk

UNAME_S := $(shell uname -s | tr '[:upper:]' '[:lower:]')
UNAME_M := $(shell uname -m)
ifeq ($(UNAME_M),x86_64)
CHAINSAW_ARCH := amd64
else ifneq ($(filter $(UNAME_M),aarch64 arm64),)
CHAINSAW_ARCH := arm64
else
$(error unsupported architecture: $(UNAME_M))
endif

ifeq ($(UNAME_S),darwin)
CHAINSAW_OS := darwin
else ifeq ($(UNAME_S),linux)
CHAINSAW_OS := linux
else
$(error unsupported OS: $(UNAME_S))
endif

CHAINSAW_URL := https://github.com/kyverno/chainsaw/releases/download/$(CHAINSAW_VERSION)/chainsaw_$(CHAINSAW_OS)_$(CHAINSAW_ARCH).tar.gz

CHAINSAW_CMD := $(shell command -v chainsaw 2>/dev/null)
ifndef CHAINSAW_CMD
CHAINSAW_CMD := $(CURDIR)/bin/chainsaw
CHAINSAW_DEPS := bin/chainsaw
endif

.PHONY: test-runtime-version test-tail-sampling test-url-templatization test-head-sampling-grpc test-head-sampling-http bin/chainsaw

bin/chainsaw:
	mkdir -p bin
	curl -fsSL "$(CHAINSAW_URL)" | tar -xz -C bin chainsaw
	chmod +x bin/chainsaw

test-runtime-version: $(CHAINSAW_DEPS)
	kind delete cluster --name test-versions
	kind create cluster --name test-versions --config tests/kind-config.yaml
	$(CHAINSAW_CMD) test tests/runtime-version

# Assumes a kind cluster with Odigos already installed at the version under test.
# Usage: make test-tail-sampling LANGUAGE=nodejs
# Usage: make test-head-sampling-http LANGUAGE=nodejs
LANGUAGE ?= nodejs

test-tail-sampling: $(CHAINSAW_DEPS)
	@test "$(filter $(LANGUAGE),nodejs)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs" && exit 1)
	@echo "language: $(LANGUAGE)" | $(CHAINSAW_CMD) test tests/tail-sampling --values -

test-head-sampling-http: $(CHAINSAW_DEPS)
	@test "$(filter $(LANGUAGE),nodejs python java)" = "$(LANGUAGE)" || (echo "LANGUAGE must be one of: nodejs python java" && exit 1)
	@echo "language: $(LANGUAGE)" | $(CHAINSAW_CMD) test tests/head-sampling-http --values -

# Assumes a kind cluster with Odigos already installed at the version under test.
test-url-templatization: $(CHAINSAW_DEPS)
	$(CHAINSAW_CMD) test tests/url-templatization

# Assumes a kind cluster with Odigos already installed at the version under test.
test-head-sampling-grpc: $(CHAINSAW_DEPS)
	$(CHAINSAW_CMD) test tests/head-sampling-grpc
