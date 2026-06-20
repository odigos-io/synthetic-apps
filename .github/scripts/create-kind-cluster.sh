#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-kind}"
BASE_CONFIG="${BASE_CONFIG:-tests/kind-config.yaml}"

echo "Creating kind cluster '${CLUSTER_NAME}'"
kind create cluster --name "${CLUSTER_NAME}" --config "${BASE_CONFIG}"
