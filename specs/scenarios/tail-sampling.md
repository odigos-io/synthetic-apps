# tail-sampling Topology

Synthetic app for Odigos **tail sampling** (workload collector): cost reduction, duration thresholds, errors, route / route-prefix match, multi-hop traces, and dry-run `odigos.sampling.*` attributes on exported spans.

**One binary, three Deployments** — same image and full route table on each; traffic target + scoped [`Sampling`](../../scenarios/tail-sampling/nodejs/deployments/tail-sampling/sampling.yaml) CR pick the scenario. Reference: [`scenarios/tail-sampling/nodejs/`](../../scenarios/tail-sampling/nodejs/). HTTP **8080**, GET, deterministic JSON; `?error=true` → **500** where supported.

| Deployment | Sampling manifest | Curl Job (`make trigger`) |
|------------|-------------------|---------------------------|
| `tail-sampling` | `deployments/tail-sampling/sampling.yaml` | `tail-sampling-curls` |
| `tail-sampling-errors` | `deployments/errors/sampling.yaml` | `tail-sampling-errors-curls` |
| `tail-sampling-duration` | `deployments/duration/sampling.yaml` | `tail-sampling-duration-curls` |

E2E: [`scenarios/tail-sampling/test/chainsaw-test.yaml`](../../scenarios/tail-sampling/test/chainsaw-test.yaml) (dry run on, span + metric asserts for errors/duration Jobs; main Deployment — config assert + curls, span batch TBD).

---

## Rules (by deployment)

**`tail-sampling`** — `cost-reduction-rest` (≤10%), `duration-above-500ms` (≥50%), `high-relevance-duration-above-1000ms` (100%), `high-relevance-error` (100%, `routePrefix: /sampling/tail`).

**`tail-sampling-errors`** — `high-relevance-error` (100%, any error trace), `cost-reduction-ok-baseline` (`httpServer.route: /ok`, ≤10%). No catch-all: unmatched success → **no** `odigos.sampling.*`.

**`tail-sampling-duration`** — same duration + catch-all rules as combined workload, **no** error rule.

Fixed path delays: **short** ~50ms, **medium** ~750ms, **long** ~1500ms. Query `?ms=N` sets delay on `/duration*`.

**Sampling outcome** — rule name and target rate; probabilistic rules export attrs in dry run but `odigos.sampling.trace.kept` is only asserted for deterministic (typically 100%) cases.

---

## Endpoints

### Shared

| Path | Role | Span ~duration | Calls (curl Job) | Outcome (per Deployment) |
|------|------|----------------|------------------|---------------------------|
| `/healthz` | Liveness / Job sanity | ~0ms | 1× each Job | **duration**: `cost-reduction-rest` ≤10%. **errors**: no rule, no sampling attrs. **tail**: not in main curl sequence |

### `tail-sampling` — `/sampling/tail/*`

| Path | Role | Span ~duration | Calls | Success → rule (rate) | Error (`?error=true` or 500) |
|------|------|----------------|-------|------------------------|------------------------------|
| `/sampling/tail/no-rule` | Baseline + prefix error | ~0ms | 1 ok, 1 err | `cost-reduction-rest` ≤10% | `high-relevance-error` 100% |
| `/sampling/tail/error` | Named error route | ~0ms | 1 ok, 1 err | cost reduction ≤10% | high-relevance error 100% |
| `/sampling/tail/duration/short` | Below 500ms tier | ~50ms | 30 ok, 1 err | cost reduction ≤10% | high-relevance error 100% |
| `/sampling/tail/duration/medium` | 500ms+ tier | ~750ms | 6 ok, 1 err | `duration-above-500ms` ≥50% | high-relevance error 100% |
| `/sampling/tail/duration/long` | 1000ms+ tier | ~1500ms | 1 ok, 1 err | `high-relevance-duration-above-1000ms` 100% | high-relevance error 100% |
| `/sampling/tail/hops?hops=N` | Propagating multi-hop | ~0ms × hops | 1 ok (`hops=3`), 1 err | cost reduction on success | error 100% (status propagates) |
| `/sampling/tail/hops/non-propagating-error?hops=N` | Internal error, client 200 | ~0ms × hops | 1 ok, 1 with `error=true` | cost reduction; trace-level error decision on internal span | same path with error flag |

### `tail-sampling-errors` — root paths

| Path | Role | Span ~duration | Calls | Outcome |
|------|------|----------------|-------|---------|
| `/ok` | Route-scoped cost reduction | ~0ms | 30× | `cost-reduction-ok-baseline` ≤10% |
| `/error` | Always failing | ~0ms | 1× (expect 500) | `high-relevance-error` 100% |
| `/alternate` | Alternating 200/500 | ~0ms | 1 ok, 1 err | even: **no** sampling; odd: high-relevance error 100% |
| `/hops?hops=N` | Client 200, final hop 500 | ~0ms × hops | 1× (`hops=3`) | error rule on internal failing span |

### `tail-sampling-duration` — `/duration*`

| Path | Role | Span ~duration | Calls | Outcome |
|------|------|----------------|-------|---------|
| `/duration?ms=0` | Explicit 0ms | 0ms | 1× | `cost-reduction-rest` ≤10% |
| `/duration?ms=600` | Just above 500ms threshold | 600ms | 1× | `duration-above-500ms` ≥50% |
| `/duration?ms=1200` | Just above 1000ms threshold | 1200ms | 1× | `high-relevance-duration-above-1000ms` 100% |
| `/duration/short` | Fixed short tier | ~50ms | 30× | cost reduction ≤10% |
| `/duration/medium` | Fixed medium tier | ~750ms | 6× | duration-above-500ms ≥50% |
| `/duration/long` | Fixed long tier | ~1500ms | 1× | high-relevance duration 100% |

---

## Dry run attributes

With `sampling.dryRun: true`, spans still export: `odigos.sampling.category`, `odigos.sampling.span.matching_rule.*`, `odigos.sampling.trace.deciding_rule.*`, and sometimes `odigos.sampling.trace.kept`. Assert via [`simple_trace_db_span_query_runner.sh`](../../tests/common/assert/simple_trace_db_span_query_runner.sh) + `SpanBatchTest` YAML under `scenarios/tail-sampling/test/queries/`.

## Implementing

- Image: `deployments/tail-sampling/Dockerfile` — tag e.g. `ghcr.io/odigos-io/synthetic-apps/<language>-tail-sampling:tail-sampling`
- Apply Deployments/Services/Sources in app namespace; Sampling CRs in `odigos-system`; label Sources for data stream ([`apply-data-stream-to-sources.sh`](../../tests/common/apply/apply-data-stream-to-sources.sh))
- Local traffic: `scripts/call-*.sh`; cluster: `deployments/*/curl-job.yaml`
  
