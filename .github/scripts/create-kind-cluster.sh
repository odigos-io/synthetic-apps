#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-kind}"
BASE_CONFIG="${BASE_CONFIG:-tests/kind-config.yaml}"
DEPOT_REGISTRY="${DEPOT_REGISTRY:-p0xd21zf5r.registry.depot.dev}"

if [[ -z "${DEPOT_SYNTHTIC_APPS_PULL_TOKEN:-}" ]]; then
  echo "DEPOT_SYNTHTIC_APPS_PULL_TOKEN is required to pull images from ${DEPOT_REGISTRY}" >&2
  exit 1
fi

escape_toml_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

escaped_password="$(escape_toml_string "${DEPOT_SYNTHTIC_APPS_PULL_TOKEN}")"
config_file="$(mktemp)"
trap 'rm -f "${config_file}"' EXIT

{
  cat "${BASE_CONFIG}"
  cat <<EOF
containerdConfigPatches:
- |-
  [plugins."io.containerd.grpc.v1.cri".registry.configs."${DEPOT_REGISTRY}".auth]
    username = "x-token"
    password = "${escaped_password}"
EOF
} > "${config_file}"

echo "Creating kind cluster '${CLUSTER_NAME}' with Depot registry auth for ${DEPOT_REGISTRY}"
kind create cluster --name "${CLUSTER_NAME}" --config "${config_file}"
