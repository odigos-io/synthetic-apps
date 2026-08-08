#!/usr/bin/env bash
set -euo pipefail

# Version is optional. Empty / e2e-test / 0.0.0-e2e-test → install latest chart
# (typical when component images come from a Depot CI run via HELM_VALUES_FILE).
VERSION="${1:-}"
TIER="${2:-enterprise}"
VERSION="${VERSION#v}"

case "${TIER}" in
  enterprise|oss) ;;
  *)
    echo "Invalid tier: ${TIER} (expected enterprise or oss)" >&2
    exit 1
    ;;
esac

helm repo add odigos https://odigos-io.github.io/odigos/ 2>/dev/null || true
helm repo update

HELM_SET_ARGS=(
  --set collectorGateway.minReplicas=2
  --set collectorGateway.maxReplicas=2
  --set collectorGateway.requestCPUm=10
  --set collectorGateway.limitCPUm=100
  --set collectorGateway.requestMemoryMiB=32
  --set collectorGateway.limitMemoryMiB=256
  --set ownTelemetry.metricsStore.disabled=false
)

if [[ "${TIER}" == "enterprise" ]]; then
  if [[ -z "${ODIGOS_ONPREM_TOKEN:-}" ]]; then
    echo "Enterprise tier requires ODIGOS_ONPREM_TOKEN to be set" >&2
    exit 1
  fi
  HELM_SET_ARGS+=(--set "onPremToken=${ODIGOS_ONPREM_TOKEN}")
fi

if [[ -n "${HELM_VALUES_FILE:-}" ]]; then
  if [[ ! -f "${HELM_VALUES_FILE}" ]]; then
    echo "HELM_VALUES_FILE does not exist: ${HELM_VALUES_FILE}" >&2
    exit 1
  fi
  echo "Using Helm values override: ${HELM_VALUES_FILE}"
fi

case "${VERSION}" in
  ""|e2e-test|0.0.0-e2e-test)
    echo "Installing Odigos ${TIER} chart (latest; mock/CI tag '${VERSION:-<empty>}')..."
    helm upgrade --install odigos odigos/odigos \
      --namespace odigos-system \
      --create-namespace \
      "${HELM_SET_ARGS[@]}" \
      ${HELM_VALUES_FILE:+-f "${HELM_VALUES_FILE}"} \
      --wait \
      --timeout 2m
    ;;
  *)
    echo "Installing Odigos ${TIER} chart version ${VERSION}..."
    helm upgrade --install odigos odigos/odigos \
      --version "${VERSION}" \
      --namespace odigos-system \
      --create-namespace \
      "${HELM_SET_ARGS[@]}" \
      ${HELM_VALUES_FILE:+-f "${HELM_VALUES_FILE}"} \
      --wait \
      --timeout 2m
    ;;
esac
