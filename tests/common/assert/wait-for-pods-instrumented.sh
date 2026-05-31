#!/bin/sh
# Wait until every Running or Pending workload pod in NAMESPACE has odigos.io/agents-meta-hash.
# Pods labeled odigos.io/test-infra=true (curl Jobs, etc.) are skipped.
#
# Usage:
#   NAMESPACE=my-ns ./wait-for-pods-instrumented.sh
#   NAMESPACE=my-ns TIMEOUT_SECONDS=300 POLL_INTERVAL=2 ./wait-for-pods-instrumented.sh

set -eu

NAMESPACE="${NAMESPACE:-${1:-}}"
if [ -z "${NAMESPACE}" ]; then
  echo "NAMESPACE is required (env var or first argument)" >&2
  exit 2
fi

if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  echo "namespace ${NAMESPACE} does not exist" >&2
  exit 2
fi

LABEL_KEY='odigos.io/agents-meta-hash'
SKIP_LABEL_JSONPATH='{.metadata.labels.odigos\.io/test-infra}'
POLL_INTERVAL="${POLL_INTERVAL:-2}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-300}"
deadline=$(($(date +%s) + TIMEOUT_SECONDS))

pods_instrumented() {
  active=0
  skipped=0
  uninstrumented=""

  for phase in Running Pending; do
    for pod in $(kubectl get pods -n "${NAMESPACE}" --field-selector=status.phase="${phase}" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'); do
      [ -z "${pod}" ] && continue

      if [ "$(kubectl get pod "${pod}" -n "${NAMESPACE}" -o jsonpath="${SKIP_LABEL_JSONPATH}" 2>/dev/null || true)" = "true" ]; then
        skipped=$((skipped + 1))
        continue
      fi

      active=$((active + 1))
      hash=$(kubectl get pod "${pod}" -n "${NAMESPACE}" -o jsonpath='{.metadata.labels.odigos\.io/agents-meta-hash}' 2>/dev/null || true)
      if [ -z "${hash}" ]; then
        uninstrumented="${uninstrumented} ${pod}"
      fi
    done
  done

  if [ "${active}" -eq 0 ]; then
    echo "no Running or Pending workload pods in ${NAMESPACE} yet (skipped ${skipped} test-infra pod(s))"
    return 1
  fi

  if [ -n "${uninstrumented}" ]; then
    echo "pods missing ${LABEL_KEY}:${uninstrumented}"
    return 1
  fi

  echo "all ${active} workload pod(s) in ${NAMESPACE} have ${LABEL_KEY} (skipped ${skipped} test-infra pod(s))"
  return 0
}

while [ "$(date +%s)" -lt "${deadline}" ]; do
  if pods_instrumented; then
    exit 0
  fi
  sleep "${POLL_INTERVAL}"
done

echo "timed out waiting for ${LABEL_KEY} on workload pods in ${NAMESPACE}" >&2
kubectl get pods -n "${NAMESPACE}" -o custom-columns=NAME:.metadata.name,PHASE:.status.phase,TEST_INFRA:.metadata.labels.odigos\\.io/test-infra,AGENTS_META_HASH:.metadata.labels.odigos\\.io/agents-meta-hash
exit 1
