#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${ODIGOS_NAMESPACE:-odigos-system}"

echo "Waiting for Odigos deployments in namespace ${NAMESPACE}..."
kubectl wait --for=condition=available deployment --all \
  -n "${NAMESPACE}" \
  --timeout=600s

echo "Waiting for odigos-instrumentor pod..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=odigos-instrumentor \
  -n "${NAMESPACE}" \
  --timeout=300s

echo "Waiting for webhook service endpoints..."
kubectl wait --for=jsonpath='{.subsets[*].addresses[0].ip}' \
  endpoints odigos-instrumentor \
  -n "${NAMESPACE}" \
  --timeout=120s

echo "Waiting for Source CRD..."
kubectl wait --for=condition=established --timeout=120s crd/sources.odigos.io

echo "Odigos is ready"
