# Shared helpers for rollout scenario Makefiles.
#
# Optional: set OTEL_DISTRO_NAME to override otelDistroName on applied Source manifests.
# Example: OTEL_DISTRO_NAME=opentelemetry-ebpf-instrumentation make apply
OTEL_DISTRO_NAME ?=
HELM_CHART ?= ../helm
HELM_VALUES ?= helm-values.yaml
ODIGOS_NAMESPACE ?= odigos-system

.PHONY: apply-odigos-sources
apply-odigos-sources:
	helm template odigos-sources $(HELM_CHART) -f $(HELM_VALUES) \
		$(if $(OTEL_DISTRO_NAME),--set-string otelDistroName=$(OTEL_DISTRO_NAME),) \
		| kubectl apply -f -

# Toggle automatic rollout via odigos-local-ui-config.
# Usage:
#   make set-automatic-rollout-disabled AUTOMATIC_ROLLOUT_DISABLED=true
#   make set-automatic-rollout-disabled AUTOMATIC_ROLLOUT_DISABLED=false
.PHONY: set-automatic-rollout-disabled
set-automatic-rollout-disabled:
ifndef AUTOMATIC_ROLLOUT_DISABLED
	$(error AUTOMATIC_ROLLOUT_DISABLED is required (true or false))
endif
	@test "$(AUTOMATIC_ROLLOUT_DISABLED)" = "true" -o "$(AUTOMATIC_ROLLOUT_DISABLED)" = "false" || \
		(echo "AUTOMATIC_ROLLOUT_DISABLED must be true or false" && exit 1)
	@CONFIG_YAML=$$(printf '%s\n' \
		'configVersion: 0' \
		'rollout:' \
		'  automaticRolloutDisabled: $(AUTOMATIC_ROLLOUT_DISABLED)') && \
	kubectl create configmap odigos-local-ui-config \
		--namespace=$(ODIGOS_NAMESPACE) \
		--from-literal=config.yaml="$$CONFIG_YAML" \
		--dry-run=client -o yaml | \
	kubectl label --local -f - odigos.io/config=local-ui --dry-run=client -o yaml | \
	kubectl apply -f -

# Set maxConcurrentRollouts via odigos-local-ui-config.
# Usage:
#   make set-max-concurrent-rollouts MAX_CONCURRENT_ROLLOUTS=1
#   make set-max-concurrent-rollouts MAX_CONCURRENT_ROLLOUTS=0
.PHONY: set-max-concurrent-rollouts
set-max-concurrent-rollouts:
ifndef MAX_CONCURRENT_ROLLOUTS
	$(error MAX_CONCURRENT_ROLLOUTS is required (integer; 0 = unlimited))
endif
	@CONFIG_YAML=$$(printf '%s\n' \
		'configVersion: 0' \
		'rollout:' \
		'  maxConcurrentRollouts: $(MAX_CONCURRENT_ROLLOUTS)') && \
	kubectl create configmap odigos-local-ui-config \
		--namespace=$(ODIGOS_NAMESPACE) \
		--from-literal=config.yaml="$$CONFIG_YAML" \
		--dry-run=client -o yaml | \
	kubectl label --local -f - odigos.io/config=local-ui --dry-run=client -o yaml | \
	kubectl apply -f -
