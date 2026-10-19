# java-claims-intake

A demo app for **interrogation**, the Insights feature that reads a service's CPU profiles, asks an LLM which
functions are worth tracing, and applies those functions as custom probes. You don't change code or redeploy, and you
don't need to know the codebase.

No `InstrumentationRule` ships with the app on purpose. Every span below the HTTP entry span is one that interrogation
chose.

## The story

**Meridian Mutual** is a mid-size insurer. Last year it acquired Harbor Point Insurance and, with it, `claims-intake`:
the Spring Boot service that partner portals (fleet operators, health networks, logistics companies) call to file
claims, check their status, and approve payouts. The Harbor Point engineers who wrote it have since left. It now
belongs to the Meridian platform team, who have never read most of it.

Three teams need something from this service this quarter, and none of them can get it from the traces they have
today:

- **SRE.** Partner portals report that filing a claim "sometimes feels slow". The dashboard shows one span, `POST
  /claims`, at about 20 ms. Nobody can say which part of that is fraud scoring, PDF rendering, or the policy lookup,
  because none of them produce spans.
- **Security and compliance.** The state insurance regulator's annual exam is coming, and the auditors want evidence
  rather than assurances. They want to see that every claim lookup passes a tenant isolation check, that claimant SSNs
  are tokenized before anything is stored, and that every payout is authorized and signed. Today those controls are
  just method calls inside an uninstrumented monolith.
- **The fraud team.** They ship *release 2.4* next sprint. It adds fraud ring detection, which links claimants who
  share bank accounts and addresses across policies, and it is expected to be expensive. They want to see its cost in
  production from day one, without opening a ticket against a platform team that is already behind.

The usual fix is manual instrumentation. Someone has to learn an inherited codebase, guess which of its classes
matter, add OpenTelemetry spans by hand, get the change reviewed, and redeploy, then do it all again for 2.4. That
takes weeks, it competes with feature work, and the result depends on how well that person happened to guess.

### What interrogation does instead

```
 Java agent profiler            Insights (leader replica)                  Odigos
 ───────────────────            ─────────────────────────                  ──────
 on-CPU stack samples   ──▶  correlate each stack to the trace's   ──▶  InstrumentationRule
 tagged with trace id        transaction (e.g. "POST /claims")           scoped to this workload
                             │                                           │
                             ▼                                           ▼
                             call trie per transaction               Java agent adds spans for
                             (application frames only:               the chosen methods; they show
                             no JDK, Spring, Tomcat)                 up in traces with no code change
                             │                                       and no redeploy
                             ▼
                             evidence = hot functions + caller→callee edges
                             │
                             ▼
                             LLM picks a few probes per category
                             (observability / security / performance)
                             and cites evidence for each one
```

These are the points to make when you demo it:

1. **It starts from what the code actually does.** Evidence comes from profile samples taken during real requests,
   not from static analysis. The call graph the model sees is the code path production actually runs.
2. **It works per transaction.** `POST /claims`, `GET /claims/{id}` and `POST /claims/{id}/approve` are analyzed
   separately, so each route gets probes that matter for that route.
3. **It skips framework noise.** Only application frames reach the model. JDK, Spring, Tomcat and logging frames are
   filtered out, and the prompt tells the model to prefer precise verbs (`tokenizeSsn`, `authorizeApproval`) over
   glue (`toView`) and entry handlers.
4. **It sorts probes into three categories.** Each one is labeled *observability* (where the work happens),
   *security* (auth, tenancy, crypto, PII), or *performance* (hot or expensive frames). Those three map directly onto
   the three teams in the story.
5. **Every probe says why it was chosen.** Each recommendation must cite a function name, a caller→callee edge, or a
   `seenCount` from the evidence, and the justification is stored on the probe in the rule.
6. **It follows the code as it changes.** The loop re-analyzes only when the *structure* of a transaction's evidence
   changes. When 2.4 turns on, the model gets a delta of only the new functions and edges, and is told which probes
   already exist.
7. **It doesn't repeat itself.** A probe that already exists (for example `verifySessionToken`, which all three routes
   call) is not recommended again.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /claims` | File a claim. JSON body: `policyNumber`, `claimantSsn`, `amountCents`, `category` (`AUTO` or `PROPERTY`), `attachments`, `description`. |
| `GET /claims/{id}` | Claim status, with the SSN masked. Seeded claims are `CLM-1` through `CLM-300`. |
| `POST /claims/{id}/approve` | Adjudicate and pay out. Needs `X-Adjuster-Id`. Adjusters starting with `senior-` can approve any amount; others are capped at $3,000. |
| `POST /admin/features/fraud-ring-detection?enabled=true\|false` | Turns release 2.4 on or off at runtime. In-process state, so a restart resets it. |
| `GET /admin/features` | Current feature flags. |
| `GET /health` | Liveness and readiness. |

The claim endpoints need `Authorization: Bearer <anything>` and `X-Tenant-Id`. Seeded record `n` belongs to tenant
`n % 3` (`acme-logistics`, `brightside-health`, `coastal-fleet`). Asking for another tenant's claim returns 403.

## Call graph

Package `com.meridian.claims`. These are the frames a profile sees under each transaction:

```
POST /claims
  api.ClaimsController.submit
    intake.ClaimIntakeService.submitClaim
      security.SessionTokenVerifier.verifySessionToken      bearer token HMAC check
      intake.PolicyEligibilityChecker.validateCoverage
        store.PolicyRepository.loadPolicy
      security.PiiTokenizer.tokenizeSsn                     SSN → vault token before storage
      fraud.FraudScoringEngine.scoreClaim                   the CPU hotspot (about half the request)
        fraud.FraudFeatureExtractor.extractFeatures
        fraud.FraudModel.predict
        fraud.FraudRingDetector.detectRings                 release 2.4 only; linear in attachments
      intake.ClaimDocumentRenderer.renderClaimSummary       linear in attachments
      store.ClaimRepository.save
      store.AuditTrail.record

GET /claims/{id}
  api.ClaimsController.get
    query.ClaimQueryService.findClaim
      security.SessionTokenVerifier.verifySessionToken
      store.ClaimRepository.findById
      security.TenantGuard.enforceTenantIsolation           cross-tenant read protection
      security.PiiTokenizer.maskForDisplay
      query.ClaimMapper.toView                              glue; should not be probed

POST /claims/{id}/approve
  api.ClaimsController.approve
    payout.AdjudicationService.adjudicate
      security.SessionTokenVerifier.verifySessionToken
      store.ClaimRepository.findById
      security.TenantGuard.enforceTenantIsolation
      security.AdjusterAuthorizer.authorizeApproval         approval authority vs. claim amount
      store.PolicyRepository.loadPolicy
      payout.PayoutCalculator.calculatePayout
        payout.DeductibleRules.applyDeductible
      security.PayoutInstructionSigner.signPayoutInstruction   signs the bank payout instruction
      store.ClaimRepository.save
      store.AuditTrail.record
```

Each method burns its own CPU in a loop written into that method, so the profile attributes time to the method that
spends it. Nothing in the app sleeps, because an on-CPU profile cannot see a thread that is waiting. The JVM runs with
`-XX:CompileCommand=dontinline,com.meridian.claims.*::*` so the JIT keeps every method as its own frame. On an Apple
silicon laptop under Docker, steady-state latency is about 18 ms for `POST /claims`, 5 ms for `GET`, and 11 ms for
`approve`. Release 2.4 adds about 7 ms to `POST /claims` and raises the share of claims sent to manual review from
under 1% to about 13%.

### What a good run recommends

Model output varies from run to run. The table shows what a good result looks like, and it is the list to check a
run against. The model is asked for 0–3 probes per transaction where possible, so it will not pick every row.

| Transaction | Category | Expected probe | Why it should be picked |
| --- | --- | --- | --- |
| `POST /claims` | performance | `fraud.FraudScoringEngine.scoreClaim` (or `FraudModel.predict` / `FraudFeatureExtractor.extractFeatures`) | Highest `seenCount`; fan-out hub under `submitClaim`. |
| `POST /claims` | security | `security.PiiTokenizer.tokenizeSsn` | "tokenize" and "Ssn" mark it as PII handling. |
| `POST /claims` | security | `security.SessionTokenVerifier.verifySessionToken` | Authentication on every route. |
| `POST /claims` | performance | `intake.ClaimDocumentRenderer.renderClaimSummary` | Rendering sits next to persistence and scales with attachments. |
| `POST /claims` | observability | `intake.PolicyEligibilityChecker.validateCoverage` | Its result decides whether the request succeeds. |
| `GET /claims/{id}` | security | `security.TenantGuard.enforceTenantIsolation` | Tenancy check on a read path. |
| `GET /claims/{id}` | security | `security.PiiTokenizer.maskForDisplay` | PII on the way out. |
| `POST /claims/{id}/approve` | security | `security.AdjusterAuthorizer.authorizeApproval` | Authorization ("authorize" in the name). |
| `POST /claims/{id}/approve` | security | `security.PayoutInstructionSigner.signPayoutInstruction` | Cryptographic signing of a money movement. |
| `POST /claims/{id}/approve` | observability | `payout.PayoutCalculator.calculatePayout` | Calculates the amount Meridian pays. |
| `POST /claims` after 2.4 (delta) | performance | `fraud.FraudRingDetector.detectRings` | New edge `FraudScoringEngine.scoreClaim → FraudRingDetector.detectRings` with a high `seenCount`. |

These should **not** be picked: `ClaimsController.*` (HTTP entry handlers, already covered by the server span),
`ClaimMapper.toView` (glue), and anything outside `com.meridian.claims`. If they show up, that is a finding about the
prompt or the frame filter, not about the app.

## Prerequisites

- A kind cluster with Odigos Enterprise and Insights installed (see the Odigos kind setup), with Java profiling
  enabled.
- Insights running with interrogation on: `INTERROGATION_ENABLED=true`, a LiteLLM master key
  (`INTERROGATION_LITELLM_MASTER_KEY`), and `INTERROGATION_AUTO_APPLY=true`. With auto-apply off, the loop still
  analyzes and records its recommendations, which `make runs` shows, but it writes no rule. That dry-run mode is
  useful for a "here is what it would do" version of the demo.

## Build and deploy

```bash
cd java/claims-intake
make deploy     # docker build, kind load, apply Deployment, Service and Source, restart
make loadgen    # about 10 rps: 60% POST /claims, 30% GET /claims/{id}, 10% approvals
```

About 4% of submissions target a lapsed policy and return 422. That is intentional; it gives the eligibility check
something to do.

## Demo walkthrough

**Act 1: the black box.** Deploy and start traffic. Open a `POST /claims` trace in your tracing backend or the Odigos
UI. Odigos auto-instrumentation already gives you a server span per route, with no code changes, but each one is a
single bar. Ask the three questions from the story: where does the 20 ms go? Was this SSN tokenized? Was this payout
signed by someone authorized? The trace can't answer any of them.

**Act 2: interrogation.** Within a few minutes of traffic (the trie flusher and the analysis loop each run once a
minute), the loop analyzes each transaction. Show what it decided and why:

```bash
make runs       # one row per recommendation: transaction, category, function, and the model's justification
```

Read a few of the `why` fields aloud. They cite real edges and `seenCount`s, for example
"`FraudScoringEngine.scoreClaim` is called from `ClaimIntakeService.submitClaim` (seenCount=…) and fans out to
`FraudModel.predict`". That is the point: these aren't guesses about what sounds important. Each one comes with
evidence from the profile.

**Act 3: the probes land.** With auto-apply on, the loop writes one `InstrumentationRule` for the workload:

```bash
make probes        # className.methodName, one per line
make probes-yaml   # the full rule, including each probe's category and justification
```

Open a fresh `POST /claims` trace. The server span now has children, and each team gets its answer:

- SRE: `scoreClaim` holds about half the request, and `renderClaimSummary` grows with attachments.
- Compliance: `tokenizeSsn` runs on every submission, `enforceTenantIsolation` on every read, and
  `authorizeApproval` plus `signPayoutInstruction` on every payout. Each one is a span in every trace, which is the
  evidence the auditors asked for.

**Act 4: release 2.4.** Ship the fraud team's change. In the story it's a release; here it's a runtime flag:

```bash
make release-2.4
```

Submissions now run `FraudRingDetector.detectRings`. The `POST /claims` call graph has a new function and a new edge,
so its evidence hash changes and the next tick re-analyzes. This time the model gets a delta of only the new frames,
along with the probes that already exist. Run `make runs` again: the new row should be a performance probe on
`detectRings`, and it should not repeat the probes from act 3. The fraud team sees the cost of their release in the
first traces after it ships, and nobody filed a ticket.

**Wrap-up.** You started from one span per route on an inherited codebase nobody knows. Without a code change or a
redeploy, you ended with spans that answer an SRE question, a compliance question, and a release-readiness question,
each with a stated reason, and it kept up when the code changed.

### Resetting between demos

```bash
make reset-probes   # delete the generated rule, forget past analyses for this namespace, restart the app
make rollback-2.4   # turn release 2.4 off again (a restart also resets it)
make loadgen-stop
make clean          # remove the namespace and the generated rule
```

Restart the app after removing probes (`reset-probes` does this). The Java agent keeps methods it has already
instrumented until the JVM restarts. The call trie is cumulative: once 2.4 has run, the replayed first analysis
already includes `detectRings` in its full evidence. To replay act 4 as a delta, recreate the cluster's Insights data
or use a fresh namespace (`make deploy loadgen K8S_NAMESPACE=claims-demo-2`, after updating the namespace in
`odigos-instrument.yaml`).

The loop also does not retry a run that failed (for example, a model timeout) until the evidence changes. If `make
runs` shows an `error`, `make reset-probes` gets it analyzing again.

## Tuning

All work sizes are loop iterations, read from environment variables at startup. Raise or lower them if your machine is
much faster or slower, or if the profiler isn't sampling a method often enough for it to appear.

| Variable | Method | Default |
| --- | --- | --- |
| `TOKEN_VERIFY_WORK` | `SessionTokenVerifier.verifySessionToken` | 800000 |
| `POLICY_LOAD_WORK` | `PolicyRepository.loadPolicy` | 600000 |
| `ELIGIBILITY_WORK` | `PolicyEligibilityChecker.validateCoverage` | 400000 |
| `TOKENIZE_WORK` | `PiiTokenizer.tokenizeSsn` | 1200000 |
| `MASK_WORK` | `PiiTokenizer.maskForDisplay` | 200000 |
| `FEATURE_WORK` | `FraudFeatureExtractor.extractFeatures` | 2000000 |
| `MODEL_TREES` × `MODEL_TREE_WORK` | `FraudModel.predict` | 600 × 5000 |
| `RING_WORK` + `RING_ATTACHMENT_WORK` × attachments | `FraudRingDetector.detectRings` | 2500000 + 600000 × n |
| `RENDER_BASE_WORK` + `RENDER_ATTACHMENT_WORK` × attachments | `ClaimDocumentRenderer.renderClaimSummary` | 300000 + 450000 × n |
| `CLAIM_STORE_WORK` | `ClaimRepository.save` / `findById` | 250000 |
| `AUDIT_WORK` | `AuditTrail.record` | 200000 |
| `TENANT_GUARD_WORK` | `TenantGuard.enforceTenantIsolation` | 350000 |
| `AUTHORIZE_WORK` | `AdjusterAuthorizer.authorizeApproval` | 600000 |
| `PAYOUT_WORK` | `PayoutCalculator.calculatePayout` | 500000 |
| `DEDUCTIBLE_WORK` | `DeductibleRules.applyDeductible` | 700000 |
| `SIGN_WORK` | `PayoutInstructionSigner.signPayoutInstruction` | 1500000 |

`FRAUD_RING_DETECTION` (default `false`) sets the release 2.4 flag at startup.
