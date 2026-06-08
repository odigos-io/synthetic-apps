#!/usr/bin/env bash
set -euo pipefail

GRPC_HOST="${GRPC_HOST:-127.0.0.1}"
GRPC_PORT="${GRPC_PORT:-50051}"
TARGET="${GRPC_HOST}:${GRPC_PORT}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROTO_DIR="${ROOT_DIR}/proto"

if ! command -v grpcurl >/dev/null 2>&1; then
  echo "grpcurl is required (brew install grpcurl)" >&2
  exit 1
fi

echo "TARGET=${TARGET}"

grpcurl -plaintext -import-path "${PROTO_DIR}" -proto synthetic.proto \
  -d '{"message":"local-unary"}' \
  "${TARGET}" synthetic.SyntheticService/Unary

grpcurl -plaintext -import-path "${PROTO_DIR}" -proto synthetic.proto \
  -d '{"count":5}' \
  "${TARGET}" synthetic.SyntheticService/StreamNumbers

grpcurl -plaintext -import-path "${PROTO_DIR}" -proto synthetic.proto \
  -d @ "${TARGET}" synthetic.SyntheticService/ClientStreamSum <<'EOF'
{"sequence":1,"payload":"local-1"}
{"sequence":2,"payload":"local-2"}
{"sequence":3,"payload":"local-3"}
EOF

grpcurl -plaintext -import-path "${PROTO_DIR}" -proto synthetic.proto \
  -d '{"message":"local-relay"}' \
  "${TARGET}" synthetic.SyntheticService/Relay

echo "all local grpc calls succeeded"
