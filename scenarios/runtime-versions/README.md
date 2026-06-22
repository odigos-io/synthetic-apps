# runtime-versions

E2E scenario for how Odigos **instruments a language based on its runtime version**.

Each language runs the same httpserver app in multiple Deployments, each built with a different runtime version. The test verifies that Odigos detects the version, decides whether to enable the agent, injects it when supported, and exports traces.

## What it tests

- **Minimum advertised version** — agent is enabled and instrumentation works at the oldest supported runtime
- **Latest version** — agent works on the current runtime (catch regressions on new releases)
- **Unsupported version** — runtime is detected but agent stays disabled (`UnsupportedRuntimeVersion`)
- **Very old / undetectable version** — when the runtime cannot be decided, an injected agent must not crash the app

Assertions cover runtime detection, InstrumentationConfig state, agent injection into pods, and trace export.

## Languages

`nodejs`, `python`, `java`, `golang` — each under `<language>/`.

## Deployments

| Variant | Purpose |
|---------|---------|
| `versionlatest` | Latest supported runtime |
| `versionminimum` | Minimum advertised supported runtime |
| `versionminimumlegacy` | Legacy minimum (Python only) |
| `versionunsupported` | Below minimum — detected, not instrumented |
| `versionveryold` | Runtime cannot be decided — agent injected but must not crash the app |

## Endpoints

Port **8080**:

| Path | Response |
|------|----------|
| `/static/success` | `200` — `Hello, World!` |
| `/health` | `200` — JSON health status |
| `/` | `200` — JSON welcome message |

## Run

```bash
make test-runtime-versions LANGUAGE=python
```

Deploy locally: `cd python && make deploy`
