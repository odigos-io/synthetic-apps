# Multi-language head-sampling

Two small apps meant to exercise cross-service HTTP calls:

- `nodejs/`: Express server with an endpoint that calls Go.
- `go/`: Go `net/http` server with a fast "success" endpoint.

## Local run

In two terminals:

```bash
cd go
go run .
```

```bash
cd nodejs
GO_BASE_URL="http://127.0.0.1:9090" node src/index.js
```

Then call Node (which calls Go):

```bash
curl -sS "http://127.0.0.1:8080/ml/call-go" | jq .
```

