# head-sampling Topology

Synthetic app for validating Odigos **head sampling**: percentage rules, route vs route-prefix matching, templated routes, HTTP server vs client operation matching, and kubelet health probes.

Each language implementation lives under `<language>/head-sampling/` and ships **one service image** (one Dockerfile) reused by every deployment below.

## General Requirements

- Listen for HTTP on port **8080**
- Return static, deterministic JSON (or plain text for health) responses
- Honor graceful shutdown on `SIGTERM` (close the HTTP server before exit)
- Expose the same route surface from a single process; **which routes are active** and **whether outbound HTTP runs** is controlled by environment variables (see [Runtime configuration](#runtime-configuration))

Reference implementations: [`nodejs/head-sampling/`](../../nodejs/head-sampling/), [`python/head-sampling/`](../../python/head-sampling/).

## Service Image

- **One image per language**, tagged for example `ghcr.io/odigos-io/synthetic-apps/<language>-head-sampling:head-sampling`
- Built from `deployments/head-sampling/Dockerfile` (or equivalent)
- All Kubernetes Deployments in this topology use that same image with different env vars

## Deployments

A complete `head-sampling` topology has **four Deployments** (plus optional Jobs and Sampling CRDs). Names below match the Node.js reference; other languages use the same deployment names with a language-specific namespace (e.g. `nodejs-head-sampling`).

| Deployment | Purpose | Key env |
|------------|---------|---------|
| `head-sampling` | Percentage and route-prefix / templated **server** sampling rules | Default routes (no HTTP-match-only flags) |
| `head-sampling-http-server` | **Inbound** HTTP route matching (`operation.httpServer`) | `HTTP_MATCH_ENABLE_ROUTES=true` |
| `head-sampling-http-client` | **Outbound** HTTP client spans (`operation.httpClient`) on a timer | `HTTP_MATCH_ENABLE_ROUTES=false`, `HTTP_MATCH_PERIODIC_OUTBOUND=true`, `HTTP_MATCH_PEER_BASE_URL=http://head-sampling-http-server:8080` |
| `kubelet-health-probes` | Startup / readiness / liveness probe paths | `SIMULATE_STARTUP_DELAY=true` |

Each Deployment has a ClusterIP **Service** on port 8080 with the same base name as the Deployment.

### Sampling CRDs (`odigos.io/v1alpha1` / `Sampling`)

Apply one Sampling manifest per deployment variant into `odigos-system`, scoped to the corresponding Deployment in the app namespace:

| Manifest (Node.js path) | Scoped deployment |
|-------------------------|-------------------|
| `deployments/head-sampling/sampling.yaml` | `head-sampling` |
| `deployments/http-server/sampling.yaml` | `head-sampling-http-server` |
| `deployments/http-client/sampling.yaml` | `head-sampling-http-client` |

`kubelet-health-probes` has no Sampling rules.

### Optional load

| Resource | Purpose |
|----------|---------|
| `scripts/call-endpoints.sh` | Local / port-forward curls for `head-sampling` endpoints |
| `scripts/call-http-server-endpoints.sh` | Local curls for `/http-match/*` server endpoints |
| `deployments/http-server/curl-job.yaml` | In-cluster Job that hits `head-sampling-http-server` (see `make trigger-http-server-curls`) |

The **http-client** deployment generates its own load via the periodic outbound timer; it does not require an external caller for client-span tests.

## Endpoints

All paths are **GET** unless noted. Responses should be `200` with a small JSON body describing the endpoint (unless simulating probe failure).

### Health (`/healthz*`)

Used by all deployments; `kubelet-health-probes` uses the split probe paths.

| Path | Behavior |
|------|----------|
| `/healthz` | Always `200` — generic health |
| `/healthz/live` | Always `200` — liveness |
| `/healthz/startup` | `200` when started; if `SIMULATE_STARTUP_DELAY=true`, return `503` until **10s** after process start |
| `/healthz/ready` | `200` when ready; if `SIMULATE_STARTUP_DELAY=true`, return `503` until **12s** after process start |

### Percentage sampling (`/sampling/percentage/*`)

Exercised by the `head-sampling` Deployment. Pair with `deployments/head-sampling/sampling.yaml`.

| Path | Expected sampling behavior |
|------|----------------------------|
| `/sampling/percentage/no-rule` | No rule — default pipeline behavior |
| `/sampling/percentage/sampled-0` | Rule at **0%** |
| `/sampling/percentage/sampled-50` | Rule at **50%** |
| `/sampling/percentage/sampled-100` | Rule at **100%** |
| `/sampling/percentage/sampled-fallback` | Rule with no `percentageAtMost` — falls back to **0%** |

### Route sampling (`/sampling/route/*`)

| Path | Expected sampling behavior |
|------|----------------------------|
| `/sampling/route/prefix` | Matches `routePrefix: /sampling/route/prefix` |
| `/sampling/route/prefix/part-one` | Same prefix rule |
| `/sampling/route/prefix/part-one/part-two` | Same prefix rule |
| `/sampling/route/exact/:itemId` | Exact templated route (e.g. `/sampling/route/exact/*`) |
| `/sampling/route/exact/:itemId/details/:detailId` | Exact templated route with two parameters |

### HTTP route matching — server (`/http-match/*`)

Registered when `HTTP_MATCH_ENABLE_ROUTES` is not `false`. Exercised by `head-sampling-http-server` and targeted by the http-client timer. Pair with `deployments/http-server/sampling.yaml`.

| Path | Category |
|------|----------|
| `/http-match/control/no-rule` | Control — no sampling rule |
| `/http-match/exact/target` | Exact literal path |
| `/http-match/exact/post-target` | Exact path for **POST** outbound client tests |
| `/http-match/prefix/segment` | Route prefix |
| `/http-match/prefix/segment/nested` | Deeper path under same prefix |
| `/http-match/texact/:resourceId` | Templatized exact (one dynamic segment) |
| `/http-match/tprefix/:tenantId/items` | Templatized prefix |
| `/http-match/tprefix/:tenantId/items/:itemId` | Templatized prefix with extra segment |

### HTTP route matching — client (outbound)

When `HTTP_MATCH_PERIODIC_OUTBOUND=true`, the process issues periodic HTTP **client** requests (default interval **10s**) to `HTTP_MATCH_PEER_BASE_URL` (and optionally `HTTP_MATCH_EXACT_PEER_BASE_URL`). Typical tick (Node.js reference):

- GET `{peer}/http-match/exact/target` (may hit two peer bases)
- POST `{peer}/http-match/exact/post-target`
- GET `{peer}/http-match/prefix/segment`
- GET `{peer}/http-match/prefix/segment/nested`
- GET `{peer}/http-match/texact/out-peer-res`
- GET `{peer}/http-match/tprefix/out-peer-tenant/items`
- GET `{peer}/http-match/tprefix/out-peer-tenant/items/out-peer-item`

Pair outbound spans with `deployments/http-client/sampling.yaml` (`operation.httpClient`: `serverAddress`, `templatedPath`, `templatedPathPrefix`, `method`, etc.).

## Runtime configuration

| Variable | Default | Effect |
|----------|---------|--------|
| `SIMULATE_STARTUP_DELAY` | `false` | Delay `/healthz/startup` and `/healthz/ready` success |
| `HTTP_MATCH_ENABLE_ROUTES` | `true` | Register `/http-match/*` handlers when `true` |
| `HTTP_MATCH_PERIODIC_OUTBOUND` | `false` | Enable periodic outbound HTTP client requests |
| `HTTP_MATCH_PEER_BASE_URL` | `http://127.0.0.1:8080` | Base URL for most outbound requests |
| `HTTP_MATCH_EXACT_PEER_BASE_URL` | same as peer base | Second base for duplicate exact-route client calls |
| `HTTP_MATCH_OUTBOUND_INTERVAL_MS` | `10000` | Outbound timer interval (minimum 1000 ms) |

## Layout (Node.js reference)

```
<head-sampling>/
  src/                          # HTTP server + optional outbound client
  deployments/
    head-sampling/              # Dockerfile, k8s.yaml, sampling.yaml
    http-server/                # k8s.yaml, sampling.yaml, curl-job.yaml
    http-client/                # k8s.yaml, sampling.yaml
    kubelet-health-probes/      # k8s.yaml
  scripts/
    call-endpoints.sh
    call-http-server-endpoints.sh
  Makefile                      # build, apply all manifests, curl job targets
```

Apply order (reference): create app namespace → apply all Deployment/Service manifests → apply Sampling CRDs in `odigos-system`.
