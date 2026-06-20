#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Odigos version is required (e.g. v1.29.2 or 1.30.0-pre2 or 1.31.0-rc1)}"
VERSION="${VERSION#v}"

helm repo add odigos https://odigos-io.github.io/odigos/ 2>/dev/null || true
helm repo update

echo "Installing Odigos chart version ${VERSION} (kind-friendly gateway sizing)..."
helm upgrade --install odigos odigos/odigos \
  --version "${VERSION}" \
  --namespace odigos-system \
  --create-namespace \
  --set collectorGateway.minReplicas=2 \
  --set collectorGateway.maxReplicas=2 \
  --set collectorGateway.requestCPUm=10 \
  --set collectorGateway.limitCPUm=100 \
  --set collectorGateway.requestMemoryMiB=32 \
  --set collectorGateway.limitMemoryMiB=256 \
  --set ownTelemetry.metricsStore.disabled=false \
  --wait \
  --timeout 2m
