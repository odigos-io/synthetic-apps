#!/usr/bin/env bash
set -euo pipefail

# Chainsaw runs inline test scripts with /usr/bin/sh. On Ubuntu that is dash, which
# does not support `set -o pipefail` used throughout our chainsaw test steps.
if [[ "$(readlink -f /usr/bin/sh)" != "$(readlink -f /bin/bash)" ]]; then
  if command -v sudo >/dev/null 2>&1; then
    sudo ln -sf /bin/bash /usr/bin/sh
  else
    ln -sf /bin/bash /usr/bin/sh
  fi
fi

SCENARIO="${1:?scenario is required}"
LANGUAGES="${2:-nodejs}"

declare -A SCENARIO_LANGUAGES=(
  [tail-sampling]="nodejs"
  [head-sampling-http]="nodejs python java"
  [head-sampling-grpc]=""
  [url-templatization]=""
)

if [[ -z "${SCENARIO_LANGUAGES[$SCENARIO]+x}" ]]; then
  echo "Unknown scenario: ${SCENARIO}" >&2
  echo "Supported scenarios: ${!SCENARIO_LANGUAGES[*]}" >&2
  exit 1
fi

allowed="${SCENARIO_LANGUAGES[$SCENARIO]}"
test_dir="tests/${SCENARIO}"

if [[ ! -d "${test_dir}" ]]; then
  echo "Test directory not found: ${test_dir}" >&2
  exit 1
fi

run_chainsaw() {
  local lang="${1:-}"
  if [[ -n "${lang}" ]]; then
    echo "Running ${SCENARIO} for language: ${lang}"
    echo "language: ${lang}" | chainsaw test "${test_dir}" --values -
  else
    echo "Running ${SCENARIO}"
    chainsaw test "${test_dir}"
  fi
}

if [[ -z "${allowed}" ]]; then
  run_chainsaw
  exit 0
fi

IFS=',' read -ra requested <<< "${LANGUAGES}"
if [[ ${#requested[@]} -eq 0 ]]; then
  echo "At least one language is required for scenario ${SCENARIO}" >&2
  exit 1
fi

for raw in "${requested[@]}"; do
  lang="$(echo "${raw}" | xargs)"
  if [[ -z "${lang}" ]]; then
    continue
  fi
  if [[ " ${allowed} " != *" ${lang} "* ]]; then
    echo "Language '${lang}' is not supported for scenario '${SCENARIO}'. Allowed: ${allowed}" >&2
    exit 1
  fi
  run_chainsaw "${lang}"
done
