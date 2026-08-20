#!/usr/bin/env bash
# Generate a test CA, server cert (for the OTLP receiver), and client cert (for Odigos gateway).
# Output: .generated/certs/  (gitignored)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="$ROOT/.generated/certs"
mkdir -p "$CERTS"
cd "$CERTS"

DAYS="${CERT_DAYS:-365}"
NAMESPACE="${NAMESPACE:-golang-mtls-destination}"
SERVER_CN="${SERVER_CN:-mtls-otlp-receiver.${NAMESPACE}.svc.cluster.local}"

echo "==> Generating CA"
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS" -out ca.crt \
  -subj "/CN=mtls-test-ca/O=Odigos mTLS Test"

echo "==> Generating server key + CSR ($SERVER_CN)"
openssl genrsa -out server.key 4096
openssl req -new -key server.key -out server.csr \
  -subj "/CN=${SERVER_CN}/O=Odigos mTLS Test"

cat > server-ext.cnf <<EOF
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = mtls-otlp-receiver.${NAMESPACE}.svc.cluster.local
DNS.2 = mtls-otlp-receiver.${NAMESPACE}
DNS.3 = mtls-otlp-receiver
DNS.4 = localhost
IP.1 = 127.0.0.1
EOF

openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "$DAYS" -sha256 -extfile server-ext.cnf

echo "==> Generating client key + CSR (for Odigos gateway)"
openssl genrsa -out client.key 4096
openssl req -new -key client.key -out client.csr \
  -subj "/CN=odigos-gateway/O=Odigos mTLS Test"

cat > client-ext.cnf <<EOF
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client.crt -days "$DAYS" -sha256 -extfile client-ext.cnf

# Aliases matching Odigos Destination secret key names (handy for --from-file=)
cp ca.crt OTLP_CA_PEM
cp ca.crt OTLP_GRPC_CA_PEM
cp client.crt OTLP_CLIENT_CERT_PEM
cp client.crt OTLP_GRPC_CLIENT_CERT_PEM
cp client.key OTLP_CLIENT_KEY_PEM
cp client.key OTLP_GRPC_CLIENT_KEY_PEM

rm -f server.csr client.csr server-ext.cnf client-ext.cnf ca.srl

echo ""
echo "Certs written to $CERTS (gitignored)"
echo "  ca.crt / ca.key"
echo "  server.crt / server.key   (receiver)"
echo "  client.crt / client.key   (Odigos gateway / UI paste)"
echo ""
echo "Verify chain:"
openssl verify -CAfile ca.crt server.crt client.crt
