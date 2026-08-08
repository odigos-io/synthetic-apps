#!/usr/bin/env bash
# Create a docker-registry pull secret for Depot so the cluster can pull
# enterprise CI images from {org}.registry.depot.dev.
#
# Token is minted via the Depot CLI (requires `depot login`):
#   depot pull-token --project <DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID>
#
# Usage:
#   ./setup-depot-registry-auth.sh [namespace]
set -euo pipefail

NAMESPACE="${1:-odigos-system}"
DEPOT_ORG_ID="${DEPOT_ORG_ID:-p0xd21zf5r}"
DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID="${DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID:-w8zkfqwtt3}"
DEPOT_REGISTRY="${DEPOT_REGISTRY:-${DEPOT_ORG_ID}.registry.depot.dev}"
DEPOT_PULL_SECRET_NAME="${DEPOT_PULL_SECRET_NAME:-depot-regcred}"

command -v depot >/dev/null 2>&1 || {
  echo "Error: depot CLI is not installed or not in PATH." >&2
  echo "Install: https://depot.dev/docs/cli/installation" >&2
  exit 1
}
command -v kubectl >/dev/null 2>&1 || {
  echo "Error: kubectl is not installed or not in PATH." >&2
  exit 1
}

echo "Minting Depot pull token for project ${DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID}..."
TOKEN="$(depot pull-token --project "${DEPOT_ODIGOS_ENTERPRISE_REGISTRY_ID}" | tr -d '[:space:]')"
if [[ -z "${TOKEN}" || "${TOKEN}" == *Forbidden* || "${TOKEN}" == *error* || "${TOKEN}" == *unavailable* ]]; then
  echo "Error: failed to mint a Depot pull token." >&2
  echo "Run 'depot login' then retry. Output was: ${TOKEN:-<empty>}" >&2
  exit 1
fi

kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret docker-registry "${DEPOT_PULL_SECRET_NAME}" \
  --namespace="${NAMESPACE}" \
  --docker-server="${DEPOT_REGISTRY}" \
  --docker-username=x-token \
  --docker-password="${TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Created/updated secret ${NAMESPACE}/${DEPOT_PULL_SECRET_NAME} for ${DEPOT_REGISTRY}"
