#!/bin/bash
set -euo pipefail

TESTS_NAMESPACE="${TESTS_NAMESPACE:?TESTS_NAMESPACE is required}"

label="odigos.io/data-stream-${TESTS_NAMESPACE}"
sources="$(kubectl get sources -n "$TESTS_NAMESPACE" -o jsonpath='{.items[*].metadata.name}')"

if [ -z "$sources" ]; then
  echo "no sources found in namespace ${TESTS_NAMESPACE}"
  exit 1
fi

for source in $sources; do
  echo "labeling source/${source} with ${label}=true"
  kubectl label "source/${source}" -n "$TESTS_NAMESPACE" "${label}=true" --overwrite
done
