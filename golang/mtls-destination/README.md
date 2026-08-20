# golang-mtls-destination

End-to-end harness to verify that the Odigos **gateway** can export OTLP over **mutual TLS** to a receiver that requires a client certificate.

```
instrumented app  →  odigos-gateway  --(mTLS)→  mtls-otlp-receiver (debug exporter)
```

## Layout

| Path | Purpose |
|------|---------|
| `Makefile` | `make deploy` — certs, build, kind load, apply k8s, render Destinations |
| `scripts/` | Cert generation, deploy, mTLS verify helpers |
| `deployments/mtls-destination/` | Sample Go HTTP app + Source CR |
| `deployments/mtls-otlp-receiver/` | In-cluster OTLP gRPC receiver with mTLS |
| `deployments/destinations/*.tmpl` | Destination templates (checked in) |
| `.generated/` | **Local only / gitignored** — certs + rendered Destination YAMLs |

## Prerequisites

- `kubectl` pointed at a cluster with **Odigos already installed**
- `docker` and `kind`
- `openssl`, `python3`

## Quick start

```bash
cd golang/mtls-destination
make deploy
```

`make deploy` will:

1. Write certs to `.generated/certs/` (if missing)
2. Deploy an **mTLS OTLP gRPC receiver** in namespace `golang-mtls-destination`
3. Deploy and instrument the sample Go HTTP app
4. Create Destination Secrets in your Odigos namespace
5. Render Destination YAMLs under `.generated/manifests/`

Optional receiver check (no Odigos):

```bash
make verify
```

## Apply a Destination

### UI — built-in OTLP gRPC mTLS

1. Port-forward the UI and open Destinations → Add Destination → **OTLP gRPC**.
2. Endpoint: `mtls-otlp-receiver.golang-mtls-destination:4317`
3. Enable TLS, paste CA from `.generated/certs/ca.crt`
4. Enable mTLS, paste client cert/key from `.generated/certs/client.crt` and `client.key`

```bash
pbcopy < .generated/certs/ca.crt
pbcopy < .generated/certs/client.crt
pbcopy < .generated/certs/client.key
```

### kubectl — built-in OTLP or Dynamic

```bash
kubectl apply -f .generated/manifests/destination-otlp-mtls.yaml
# or
kubectl apply -f .generated/manifests/destination-dynamic-mtls.yaml
```

## Generate traffic

```bash
make trigger-curls
```

## What success looks like

```bash
# Gateway mounts Destination secret
kubectl -n odigos-system get deploy odigos-gateway \
  -o jsonpath='{.spec.template.spec.containers[0].envFrom}' ; echo

# Receiver shows exported spans
kubectl -n golang-mtls-destination logs deploy/mtls-otlp-receiver --tail=100
```

## Cleanup

```bash
make clean
```
