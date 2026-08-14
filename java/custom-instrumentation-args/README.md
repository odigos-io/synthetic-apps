# java-custom-instrumentation-args

A minimal Spring Boot app for exercising the Odigos **Insights D4 scorer**
(arguments / return values). It has two service methods that each take a single
string argument and return a string. When Odigos **Java custom instrumentation**
probes them, every call becomes a span carrying:

| attribute        | example                                   | meaning                        |
| ---------------- | ----------------------------------------- | ------------------------------ |
| `code.namespace` | `com.synthetic.custominst.UserService`    | probed class                   |
| `code.function`  | `getUser`                                 | probed method                  |
| `arg.0`          | `42`                                      | first positional argument      |
| `return.value`   | `{"id":"42","name":"user-42"}`            | stringified return value       |

Those attributes are exactly what the Insights **D4** scorer learns a profile
for and then scores new calls against.

## The two probed methods

| Endpoint                    | Method                                    | Normal argument shape        | D4 learns                         |
| --------------------------- | ----------------------------------------- | ---------------------------- | --------------------------------- |
| `GET /user?id=<id>`         | `UserService.getUser(String id)`          | numeric id (`42`, `1001`)    | `arg.0` format = **numeric**      |
| `GET /authorize?role=<r>`   | `AuthorizationService.checkRole(String)`  | `user` / `admin` / `guest`   | `arg.0` = bounded **enum** (token)|

`GET /health` is uninstrumented and used for probes.

## How the capture is configured

The capture is driven entirely by the `InstrumentationRule` in
[`deployments/custom-instrumentation-args/instrumentation-rule.yaml`](deployments/custom-instrumentation-args/instrumentation-rule.yaml):

```yaml
apiVersion: odigos.io/v1alpha1
kind: InstrumentationRule
metadata:
  name: custom-instrumentation-args
  namespace: odigos-system
spec:
  scopes:
    languages: [java]
    sources:
      - kind: Deployment
        name: custom-instrumentation-args
        namespace: java-custom-instrumentation-args
  codeAttributes:        # emit code.namespace / code.function
    function: true
    namespace: true
  customInstrumentations: # probe these methods (captures arg.0 + return.value)
    java:
      - className: com.synthetic.custominst.UserService
        methodName: getUser
      - className: com.synthetic.custominst.AuthorizationService
        methodName: checkRole
```

`codeAttributes` emits the `code.*` site attributes; `customInstrumentations.java`
adds the eBPF probe that captures the positional arguments and return value.

## Prerequisites

- A cluster with Odigos installed and **Insights** receiving traces (see the
  Insights `DEVELOPMENT.md`).
- `kubectl` pointed at that cluster; `docker` + `kind` for building/loading.

## Run it

```bash
cd java/custom-instrumentation-args

# build image, load into kind, apply Deployment + Source + InstrumentationRule
make deploy

# 1) normal traffic so Insights learns the argument profiles
make trigger-baseline

# 2) once the D4 class has PROMOTED for these transactions (see below),
#    send the malformed arguments
make trigger-attack
```

## Promotion

D4 (like the other classes) only alerts once its baseline has **promoted**. The
default policy promotes when the baseline has been unchanged for 300
observations (or after a week). `make trigger-baseline` sends 400 `getUser` and
1200 `checkRole` calls, which is enough to clear the 300-observation bar. You can
watch promotion on the Insights debug UI (`/debug/transactions`) or promote the
class manually there to shortcut the wait.

## What you'll see after `make trigger-attack`

Three anomalies on the Insights investigate page:

- **`getUser` `id="1 OR 1=1"`** — the argument, normally numeric, arrives as
  free-form text: a **D4 argument format** deviation. Because the value also
  matches an injection signature, the **"Injection-like argument / return"**
  enricher fires, pushing it into the injection risk category.
- **`getUser` `id="../../etc/passwd"`** — numeric → path format: another D4
  format deviation, enriched as path traversal.
- **`checkRole` `role="superadmin"`** — same (token) format as the learned
  roles but outside the learned set `{user, admin, guest}`: a **D4 enum**
  deviation (privilege escalation shape).

Each finding highlights the custom-instrumentation span and points at the
offending `arg.0` attribute.

## Trying it by hand

```bash
kubectl -n java-custom-instrumentation-args port-forward svc/custom-instrumentation-args 18081:8080

# normal
curl 'http://localhost:18081/user?id=42'
curl 'http://localhost:18081/authorize?role=admin'

# anomalies (after promotion)
curl -G 'http://localhost:18081/user' --data-urlencode 'id=1 OR 1=1'
curl 'http://localhost:18081/authorize?role=superadmin'
```

## Notes / caveats

- **eBPF path required for `return.value`.** Argument capture (`arg.0`..`arg.4`)
  and especially the return value are produced by the Java **eBPF** custom
  instrumentation path. On the OTel-agent path the `return.value` attribute may
  be absent; D4 still works on arguments alone.
- **Values are stringified and truncated.** The producer serializes each value
  via `toString()` and truncates (~127 chars), so very long arguments are seen
  in truncated form.
- **Enums are for categorical values only.** D4 enforces a learned enum only for
  low-cardinality *token* arguments (like `role`); high-cardinality shapes
  (numeric ids, UUIDs, emails, URLs) are checked by format, never by exact set,
  so a new-but-normal id never alerts.

## Clean up

```bash
make clean
```
