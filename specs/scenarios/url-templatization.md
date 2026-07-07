# url-templatization Scenario

Synthetic app for Odigos **default URL templatization** (workload collector): low-cardinality `http.route` on dynamic paths, framework vs raw HTTP server spans, disabled templatization baseline, and `skipPolicy.skipHttpStatusCodes` on overlapping Actions.

**One binary, five Deployments** — same image and full route table on each; scoped [`Action`](../../scenarios/url-templatization/nodejs/deployments/url-templatization/url-templatization-action.yaml) CRs pick the scenario. Reference: [`scenarios/url-templatization/nodejs/`](../../scenarios/url-templatization/nodejs/). HTTP **8080**, GET (plain-http also HEAD), deterministic JSON.

| Deployment | Action manifest(s) | Curl Job (`make trigger`) |
|------------|-------------------|---------------------------|
| `url-templatization` | `deployments/url-templatization/url-templatization-action.yaml` | `url-templatization-curls` (all five) |
| `url-templatization-disabled` | `deployments/url-templatization-disabled/url-templatization-disabled-action.yaml` | same Job |
| `url-templatization-skip-status-codes` | `deployments/url-templatization-skip-status-codes/skip-status-codes-actions.yaml` | same Job |
| `url-templatization-rules` | `deployments/url-templatization-rules/rules-action.yaml` | same Job |
| `url-templatization-rules-merge` | `deployments/url-templatization-rules-merge/rules-merge-actions.yaml` | same Job |

E2E: [`scenarios/url-templatization/test/chainsaw-test.yaml`](../../scenarios/url-templatization/test/chainsaw-test.yaml) (workload-collector config assert + curls; span batch asserts under `scenarios/url-templatization/test/queries/spans/`).

---

## Rules (by deployment)

**`url-templatization`** — default URL templatization **enabled** (`disabled: false`). Dynamic path segments on plain-http server spans become wildcard `http.route`; Express routes keep framework patterns or low-cardinality routes.

**`url-templatization-disabled`** — default templatization **disabled** for this Deployment only (`disabled: true`, scoped to `javascript`). Plain-http dynamic paths stay literal on `http.target`; Express still sets `http.route` from route definitions.

**`url-templatization-skip-status-codes`** — templatization enabled, but two Actions merge `skipPolicy.skipHttpStatusCodes`: **401, 404** (Action 1) and **400, 404** (Action 2) → effective skip set **400, 401, 404**. **2xx** and **500** still run templatization; skipped status codes bypass the templatization pass (outcome is often identical on fixed error paths).

**`url-templatization-rules`** — single Action with all six custom `urlTemplatization.rules` templates (see `rules-action.yaml`). Default templatization applies when no custom rule matches.

**`url-templatization-rules-merge`** — three Actions merge `urlTemplatization.rules` subsets with **intentional duplicates** (repeated templates within an Action and across Actions). Effective set after dedup: same six paths as `url-templatization-rules`; see `rules-merge-actions.yaml` and workload-collector assert.

---

## Server prefixes (shared route table)

Each Deployment exposes the same paths under two prefixes — the prefix determines span shape, not Odigos config.

| Prefix | Handler | Span notes |
|--------|---------|------------|
| `/http-framework/*` | Express | Framework sets `http.route` (e.g. `/default/templated/1/:seg1`); Odigos templatization applies on top where configured |
| `/plain-http/*` | `node:http` | No framework route; Odigos default templatization derives `http.route` from the raw URL path |

---

## Endpoints

### Shared

| Path | Role | Calls (curl Job) | What it tests |
|------|------|------------------|---------------|
| `/healthz` | Liveness / Job sanity | 1× per Deployment | Baseline server span; static `http.route: /healthz` on all five |

### `/http-framework/default/*` — Express inbound

| Path | Role | Calls | Outcome (per Deployment) |
|------|------|-------|---------------------------|
| `/http-framework/default` | Route index (JSON catalog) | 1× | Discovery only; not span-asserted |
| `/http-framework/default/static/a` | Static exact — 1 segment | 10× | **enabled**: exact route. **disabled**: same. **skip**: same (2xx) |
| `/http-framework/default/static/a/b` | Static exact — 2 segments | 10× | Same as static-1 |
| `/http-framework/default/static/a/b/c` | Static exact — 3 segments | 10× | Same as static-1 |
| `/http-framework/default/templated/1/foo` | 1 dynamic segment | 10× | **enabled**: low-cardinality route (Express pattern or wildcard). **disabled**: Express `:seg1` on `http.route`. **skip**: templatized on 2xx |
| `/http-framework/default/templated/2/foo/bar` | 2 dynamic segments | 10× | Same pattern, two params |
| `/http-framework/default/templated/3/foo/bar/baz` | 3 dynamic segments | 10× | Same pattern, three params |
| `/http-framework/default/outbound/static` | Client spans → all static paths | 1× | Outbound `http.route` / URL templatization on client spans |
| `/http-framework/default/outbound/templated` | Client spans → all templated examples | 1× | Outbound templated paths |
| `/http-framework/default/outbound/all` | Client spans → static + templated | 1× | Combined outbound coverage |
| `/http-framework/default/outbound/static/1` … `/3` | Client span for one static depth | 1× each | Targeted outbound by segment count |
| `/http-framework/default/outbound/templated/1` … `/3` | Client span for one templated depth | 1× each | Targeted outbound by param count |
| `/http-framework/default/errors/400` | Fixed 400 | local script only | **skip**: status in skip set → no templatization pass |
| `/http-framework/default/errors/401` | Fixed 401 | local script only | **skip**: status in skip set |
| `/http-framework/default/errors/404` | Fixed 404 | 1× (expect 404) | **enabled/disabled**: literal fixed route. **skip**: skipPolicy applies (404 skipped) |
| `/http-framework/default/errors/500` | Fixed 500 | 1× (expect 500) | **enabled/disabled/skip**: 500 not skipped; templatization runs on error span |

### `/plain-http/default/*` — raw HTTP inbound

Same route shapes as the Express table; paths replace `/http-framework` with `/plain-http`. Plain-http has no per-depth outbound shortcuts (`/outbound/static/:depth`); only `/outbound/static`, `/outbound/templated`, and `/outbound/all`.

| Path | Role | Calls | Outcome (per Deployment) |
|------|------|-------|---------------------------|
| `/plain-http/default` | Route index | 1× | Discovery only |
| `/plain-http/default/static/a` … `/a/b/c` | Static exact (1–3 segments) | 10× each | **enabled/skip**: exact `http.route`. **disabled**: same (already static) |
| `/plain-http/default/templated/1/foo` | 1 dynamic segment | 10× | **enabled**: wildcard `http.route` (e.g. `…/templated/1/*`). **disabled**: literal segment on `http.target`. **skip**: wildcard on 2xx |
| `/plain-http/default/templated/2/foo/bar` | 2 dynamic segments | 10× | Same comparison, two params |
| `/plain-http/default/templated/3/foo/bar/baz` | 3 dynamic segments | 10× | Same comparison, three params |
| `/plain-http/default/outbound/static` | Client spans → static paths | 1× | Outbound templatization on plain-http targets |
| `/plain-http/default/outbound/templated` | Client spans → templated examples | 1× | Primary signal for disabled vs enabled on client side |
| `/plain-http/default/outbound/all` | Client spans → all default paths | 1× | Full outbound matrix |
| `/plain-http/default/errors/400` | Fixed 400 | local script only | **skip**: 400 in merged skip set |
| `/plain-http/default/errors/401` | Fixed 401 | local script only | **skip**: 401 in merged skip set |
| `/plain-http/default/errors/404` | Fixed 404 | 1× (expect 404) | **skip**: 404 skipped; fixed literal route asserted |
| `/plain-http/default/errors/500` | Fixed 500 | 1× (expect 500) | Not in skip set; error span exported with templatization applied |

---

## Span assertions

Assert via [`simple_trace_db_span_query_runner.sh`](../../tests/common/assert/simple_trace_db_span_query_runner.sh) + `SpanBatchTest` YAML under `scenarios/url-templatization/test/queries/spans/`:

| Query file | Deployment | Key checks |
|------------|------------|------------|
| `url-templatization-enabled.yaml` | `url-templatization` | Plain-http templated wildcard `http.route`; framework templated route contains `/default/templated/1/`; fixed 404/500 error routes |
| `url-templatization-disabled.yaml` | `url-templatization-disabled` | Plain-http templated literal on `http.target`; framework still has Express `:seg1` pattern |
| `url-templatization-skip-status-codes.yaml` | `url-templatization-skip-status-codes` | 2xx templated wildcard; 404 fixed routes (skip list); 500 error span (not skipped) |

Workload-collector `templatizationRules` for **`url-templatization-rules`** and merged rules for **`url-templatization-rules-merge`** are asserted in [`scenarios/url-templatization/test/assert/workload-collector-config.yaml`](../../scenarios/url-templatization/test/assert/workload-collector-config.yaml).

---

## Implementing

- Image: `deployments/url-templatization/Dockerfile` — tag e.g. `p0xd21zf5r.registry.depot.dev/synthetic-apps:nodejs-url-templatization`
- Apply Deployments/Services/Sources in app namespace; Actions in `odigos-system`; label Sources for data stream ([`apply-data-stream-to-sources.sh`](../../tests/common/apply/apply-data-stream-to-sources.sh))
- Local traffic: `scripts/call-endpoints.sh` (includes 400/401 error paths); cluster: `deployments/url-templatization/curl-job.yaml`
