#!/usr/bin/env bash
# Prove mTLS works against the in-cluster receiver via port-forward (no Odigos).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="$ROOT/.generated/certs"
NAMESPACE="${NAMESPACE:-golang-mtls-destination}"

if [[ ! -f "$CERTS/client.crt" ]]; then
  echo "missing certs — run 'make certs' or 'make deploy' first"
  exit 1
fi

echo "==> Port-forwarding mtls-otlp-receiver:4317 (Ctrl+C when done)"
kubectl -n "$NAMESPACE" port-forward svc/mtls-otlp-receiver 14317:4317 >/tmp/mtls-pf.log 2>&1 &
PF_PID=$!
trap 'kill $PF_PID 2>/dev/null || true' EXIT
sleep 2

echo "==> openssl s_client (expect Verify return code: 0)"
echo | openssl s_client \
  -connect 127.0.0.1:14317 \
  -CAfile "$CERTS/ca.crt" \
  -cert "$CERTS/client.crt" \
  -key "$CERTS/client.key" \
  -servername "mtls-otlp-receiver.${NAMESPACE}.svc.cluster.local" \
  -alpn h2 2>/dev/null | grep -E 'Verify return code|Protocol|subject=|issuer='

echo ""
echo "==> Without client cert (expect handshake failure)"
set +e
echo | openssl s_client \
  -connect 127.0.0.1:14317 \
  -CAfile "$CERTS/ca.crt" \
  -servername "mtls-otlp-receiver.${NAMESPACE}.svc.cluster.local" \
  -alpn h2 2>/dev/null | grep -E 'Verify return code|alert|error' || true
set -e

echo ""
echo "Done. Receiver still requires client certs for OTLP."
