#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Odigos version is required (e.g. v1.29.0 or 1.29.0)}"
VERSION="${VERSION#v}"

if [[ -z "${ODIGOS_ONPREM_TOKEN:-}" ]]; then
  echo "ODIGOS_ONPREM_TOKEN must be set" >&2
  exit 1
fi

helm repo add odigos https://odigos-io.github.io/odigos/ 2>/dev/null || true
helm repo update

echo "Installing Odigos chart version ${VERSION} (image tag v${VERSION})..."
helm upgrade --install odigos odigos/odigos \
  --version "${VERSION}" \
  --namespace odigos-system \
  --create-namespace \
  --set image.tag="v${VERSION}" \
  --wait \
  --timeout 2m
