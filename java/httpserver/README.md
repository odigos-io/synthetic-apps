# Java Spring Boot HTTP Server

A minimal Spring Boot HTTP server implementation following the same pattern as the Python and Node.js versions.

## Features

- **Spring Boot 2.7.18** with Java 8 minimum support
- **Multi-stage Docker builds** for clean, architecture-agnostic deployments
- **Multiple deployment variants** for testing different scenarios
- **Same endpoints** as other language implementations:
  - `/static/success` - Returns "Hello, World!"
  - `/health` - Health check with timestamp
  - `/` - Root endpoint with status message

## Architecture

- **Java 8** minimum supported version
- **Spring Boot Web Starter** for HTTP server functionality
- **Maven** for dependency management and building
- **Docker multi-stage builds** to avoid committing JAR files to git

## Deployment Variants

| Variant | Description | Java Version |
|---------|-------------|--------------|
| `httpserver` | Standard deployment | Java 8 |
| `versionlatest` | Latest version | Java 8 (limited by ARM64 Alpine support) |
| `versionminimum` | Minimum supported version | Java 8 |
| `envdockerfile` | Environment variables in Dockerfile | Java 8 |
| `envmanifest` | Environment variables in Kubernetes manifest | Java 8 |

> **Note:** Java 8, released in 2014, is the minimum version supported by OpenTelemetry. Creating applications with older Java versions is not practical or supported, so only Java 8 and newer are included here.

## Building

```bash
# Build all Docker images
make build

# Build specific variant
docker build -f deployments/httpserver/Dockerfile -t java-httpserver:test .
```

## Running Locally

```bash
# Build the application
mvn clean package -DskipTests

# Run the JAR
java -jar target/httpserver-1.0.0.jar
```

## Docker

```bash
# Build and run container
docker build -f deployments/httpserver/Dockerfile -t java-httpserver:test .
docker run -d -p 8080:8080 --name java-test java-httpserver:test

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:8080/static/success
curl http://localhost:8080/
```

## Kubernetes Deployment

```bash
# Deploy to Kubernetes
make deploy

# Check status
make status

# Clean up
make clean
```

## Notes

- **ARM64 Support**: Due to limited Java image availability on ARM64 Alpine, all variants use Java 8
- **No JAR files in git**: The `.gitignore` excludes the `target/` directory
- **Multi-stage builds**: Application is built inside Docker containers for architecture consistency
- **Spring Boot**: Uses embedded Tomcat server on port 8080

## File Structure

```
java/httpserver/
├── src/
│   └── main/
│       ├── java/com/example/httpserver/
│       │   ├── HttpServerApplication.java
│       │   └── HttpServerController.java
│       └── resources/
│           └── application.properties
├── deployments/
│   ├── httpserver/
│   ├── versionlatest/
│   ├── versionminimum/
│   ├── envdockerfile/
│   └── envmanifest/
├── pom.xml
├── Makefile
├── .gitignore
└── README.md
``` 