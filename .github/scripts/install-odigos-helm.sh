#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Odigos version is required (e.g. v1.29.2 or 1.30.0-pre2 or 1.31.0-rc1)}"
VERSION="${VERSION#v}"

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
