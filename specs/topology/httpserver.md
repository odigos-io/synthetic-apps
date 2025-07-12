# httpserver Topology

Each application that implements the `httpserver` topology must:

## General Requirements

- Listen for incoming HTTP requests on port 8080
- Returns a static and deterministic response
- No load generator (must be called actively invoked to produce load)

## Endpoints

- `/static/success` - Returns a static `200` payload with the string `Hello, World!`
- `/health` - Returns a `200` to always indicate the application is healthy
