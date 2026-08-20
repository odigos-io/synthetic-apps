#!/usr/bin/env bash
# Load certs into the cluster, deploy mTLS OTLP receiver + sample app, print Destination steps.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="$ROOT/.generated/certs"
GEN_MANIFESTS="$ROOT/.generated/manifests"
NAMESPACE="${NAMESPACE:-golang-mtls-destination}"
ODIGOS_NS="${ODIGOS_NS:-odigos-system}"
KIND_CLUSTER="${KIND_CLUSTER:-}"
IMAGE="${IMAGE:-ghcr.io/odigos-io/synthetic-apps/golang-mtls-destination:mtls-destination}"

usage() {
  cat <<EOF
Usage: $0 [--odigos-ns NAMESPACE] [--kind-cluster NAME]

Environment:
  ODIGOS_NS     Odigos system namespace (default: odigos-system)
  NAMESPACE     Test workload namespace (default: golang-mtls-destination)
  KIND_CLUSTER  If set, load the sample app image into this kind cluster
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --odigos-ns) ODIGOS_NS="$2"; shift 2 ;;
    --kind-cluster) KIND_CLUSTER="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1"; usage; exit 1 ;;
  esac
done

if [[ ! -f "$CERTS/ca.crt" ]]; then
  echo "==> Generating certs into .generated/certs"
  NAMESPACE="$NAMESPACE" "$ROOT/scripts/gen-certs.sh"
else
  echo "==> Using existing certs in $CERTS"
fi

echo "==> Ensuring namespaces"
kubectl get ns "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"
kubectl get ns "$ODIGOS_NS" >/dev/null 2>&1 || {
  echo "ERROR: Odigos namespace '$ODIGOS_NS' not found. Set --odigos-ns to your Odigos install namespace."
  exit 1
}

echo "==> Creating receiver TLS secret in $NAMESPACE"
kubectl -n "$NAMESPACE" create secret generic mtls-otlp-receiver-certs \
  --from-file=ca.crt="$CERTS/ca.crt" \
  --from-file=server.crt="$CERTS/server.crt" \
  --from-file=server.key="$CERTS/server.key" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Creating Destination Secrets in $ODIGOS_NS"
kubectl -n "$ODIGOS_NS" create secret generic otlp-mtls-certs \
  --from-file=OTLP_GRPC_CLIENT_CERT_PEM="$CERTS/client.crt" \
  --from-file=OTLP_GRPC_CLIENT_KEY_PEM="$CERTS/client.key" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$ODIGOS_NS" create secret generic otlp-mtls-dynamic-certs \
  --from-file=OTLP_CA_PEM="$CERTS/ca.crt" \
  --from-file=OTLP_CLIENT_CERT_PEM="$CERTS/client.crt" \
  --from-file=OTLP_CLIENT_KEY_PEM="$CERTS/client.key" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying receiver ConfigMap + Deployment"
kubectl -n "$NAMESPACE" apply -f "$ROOT/deployments/mtls-otlp-receiver/k8s.yaml"

echo "==> Deploying sample app"
kubectl -n "$NAMESPACE" apply -f "$ROOT/deployments/mtls-destination/k8s.yaml"
kubectl -n "$NAMESPACE" apply -f "$ROOT/deployments/mtls-destination/odigos-instrument.yaml"

echo "==> Waiting for receiver + app"
kubectl -n "$NAMESPACE" rollout status deploy/mtls-otlp-receiver --timeout=180s
kubectl -n "$NAMESPACE" rollout status deploy/mtls-destination --timeout=180s

echo "==> Rendering Destination manifests into .generated/manifests"
mkdir -p "$GEN_MANIFESTS"
python3 - "$ROOT" "$ODIGOS_NS" "$NAMESPACE" "$CERTS" "$GEN_MANIFESTS" <<'PY'
import sys
from pathlib import Path

root = Path(sys.argv[1])
odigos_ns = sys.argv[2]
namespace = sys.argv[3]
certs = Path(sys.argv[4])
out_dir = Path(sys.argv[5])

ca = (certs / "ca.crt").read_text().rstrip("\n")
ca_block = "\n".join("      " + line for line in ca.splitlines()) + "\n"

for name in ("destination-otlp-mtls.yaml.tmpl", "destination-dynamic-mtls.yaml.tmpl"):
    tmpl = (root / "deployments" / "destinations" / name).read_text()
    out = (
        tmpl.replace("__ODIGOS_NS__", odigos_ns)
        .replace("__NAMESPACE__", namespace)
        .replace("__CA_PEM__", ca_block)
    )
    out_path = out_dir / name.replace(".tmpl", "")
    out_path.write_text(out)
    print(f"wrote {out_path}")
PY

cat <<EOF

============================================================
 Deployed:
   receiver: mtls-otlp-receiver.${NAMESPACE}.svc.cluster.local:4317 (mTLS required)
   app:      deploy/mtls-destination in namespace ${NAMESPACE}

 Generated (gitignored):
   certs:      ${CERTS}
   manifests:  ${GEN_MANIFESTS}

 Next steps:
   1. Wait for Odigos to instrument the app (Source CR already applied).

   2a. Built-in OTLP mTLS:
        kubectl apply -f ${GEN_MANIFESTS}/destination-otlp-mtls.yaml

   2b. Dynamic destination:
        kubectl apply -f ${GEN_MANIFESTS}/destination-dynamic-mtls.yaml

   3. For UI paste, use files under ${CERTS}:
        pbcopy < ${CERTS}/ca.crt
        pbcopy < ${CERTS}/client.crt
        pbcopy < ${CERTS}/client.key

   4. Generate traffic:
        make trigger-curls
        # or: kubectl -n ${NAMESPACE} port-forward svc/mtls-destination 8080:8080

   5. Verify:
        kubectl -n ${ODIGOS_NS} get deploy odigos-gateway -o jsonpath='{.spec.template.spec.containers[0].envFrom}'; echo
        kubectl -n ${NAMESPACE} logs deploy/mtls-otlp-receiver --tail=80
============================================================
EOF
