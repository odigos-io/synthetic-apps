# Shared helpers for pii-masking scenario Makefiles.
#
# Optional: set OTEL_DISTRO_NAME to override otelDistroName on applied Source manifests.
# Example: OTEL_DISTRO_NAME=opentelemetry-ebpf-instrumentation make apply
OTEL_DISTRO_NAME ?=
HELM_CHART ?= ../helm
HELM_VALUES ?= helm-values.yaml

.PHONY: apply-odigos-sources
apply-odigos-sources:
	helm template odigos-sources $(HELM_CHART) -f $(HELM_VALUES) \
		$(if $(NAMESPACE),--set-string namespace=$(NAMESPACE),) \
		$(if $(OTEL_DISTRO_NAME),--set-string otelDistroName=$(OTEL_DISTRO_NAME),) \
		| kubectl apply -f -
