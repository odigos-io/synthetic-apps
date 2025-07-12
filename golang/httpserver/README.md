# Go HTTP Server

A simple HTTP server written in Go that provides the same endpoints as the other language implementations.

## Endpoints

- `/static/success` - Returns "Hello, World!"
- `/health` - Health check endpoint returning JSON with status and timestamp
- `/` - Root endpoint returning a JSON message

## Versions

- **httpserver**: Go 1.21 (main version)
- **versionlatest**: Go 1.24.5 (latest stable)
- **versionminimum**: Go 1.17.0 (minimum supported)
- **versionunsupported**: Go 1.16 (unsupported version)

## Building and Deploying

```bash
# Build all Docker images
make build

# Load images to kind cluster
make load-to-kind

# Deploy to Kubernetes
make apply

# Or do all at once
make deploy

# Check status
make status

# Clean up
make clean
```

## Local Development

```bash
# Run locally
cd src
go run main.go

# Or build and run
go build -o main src/main.go
./main
```

The server will start on port 8080. 