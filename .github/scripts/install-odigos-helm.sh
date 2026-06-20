#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Odigos version is required (e.g. v1.29.2 or 1.30.0-pre2 or 1.31.0-rc1)}"
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

echo "Installing Odigos ${TIER} chart version ${VERSION} (kind-friendly gateway sizing)..."
helm upgrade --install odigos odigos/odigos \
  --version "${VERSION}" \
  --namespace odigos-system \
  --create-namespace \
  "${HELM_SET_ARGS[@]}" \
  --wait \
  --timeout 2m
