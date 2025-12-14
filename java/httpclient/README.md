# Java Spring Boot HTTP Client

A Spring Boot HTTP server that makes outgoing HTTP calls to simulate traces. When you call the `/call` endpoint, it creates an outgoing HTTP request to a target URL, which helps simulate distributed tracing scenarios.

## Features

- **Spring Boot 2.7.18** with Java 8 minimum support
- **HTTP Server** that accepts incoming requests
- **Outgoing HTTP Calls** via RestTemplate to simulate traces
- **Multi-stage Docker builds** for clean, architecture-agnostic deployments
- **Kubernetes-ready** deployment configuration

## Endpoints

- `/call?url=<target_url>` - Makes an outgoing HTTP call to the specified URL (defaults to `http://httpbin.org/get`)
- `/call/templated?url=<template_with_{uuid}>` - Makes an HTTP call with a generated UUID. The URL template should contain `{uuid}` placeholder which will be replaced with a generated UUID
- `/health` - Health check with timestamp
- `/` - Root endpoint with status message and available endpoints

## Architecture

- **Java 8** minimum supported version
- **Spring Boot Web Starter** for HTTP server functionality
- **RestTemplate** for making outgoing HTTP calls
- **Maven** for dependency management and building
- **Docker multi-stage builds** to avoid committing JAR files to git

## Building

```bash
# Build Docker image
make build

# Build specific variant
docker build -f deployments/httpclient/Dockerfile -t java-httpclient:test .
```

## Running Locally

```bash
# Build the application
mvn clean package -DskipTests

# Run the JAR
java -jar target/httpclient-1.0.0.jar
```

## Docker

```bash
# Build and run container
docker build -f deployments/httpclient/Dockerfile -t java-httpclient:test .
docker run -d -p 8080:8080 --name java-test java-httpclient:test

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:8080/call
curl http://localhost:8080/call?url=http://httpbin.org/get
curl "http://localhost:8080/call/templated?url=http://httpbin.org/uuid/{uuid}"
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

## Usage Examples

```bash
# Make a call to default URL (httpbin.org/get)
curl http://localhost:8080/call

# Make a call to a custom URL
curl "http://localhost:8080/call?url=https://api.github.com/users/octocat"

# Make a call to another service in your cluster
curl "http://localhost:8080/call?url=http://httpserver:8080/health"

# Make a templated call with UUID (UUID will be generated and inserted into the URL)
curl "http://localhost:8080/call/templated?url=http://httpbin.org/uuid/{uuid}"

# Templated call to a custom service with UUID in the path
curl "http://localhost:8080/call/templated?url=http://api.example.com/users/{uuid}/profile"
```

## Notes

- **ARM64 Support**: Uses Java 17 JDK/JRE images for better ARM64 support
- **No JAR files in git**: The `.gitignore` excludes the `target/` directory
- **Multi-stage builds**: Application is built inside Docker containers for architecture consistency
- **Spring Boot**: Uses embedded Tomcat server on port 8080
- **RestTemplate**: Synchronous HTTP client for making outgoing calls

## File Structure

```
java/httpclient/
├── src/
│   └── main/
│       ├── java/com/example/httpclient/
│       │   ├── HttpClientApplication.java
│       │   ├── HttpClientController.java
│       │   └── RestTemplateConfig.java
│       └── resources/
│           └── application.properties
├── deployments/
│   └── httpclient/
│       ├── Dockerfile
│       └── k8s.yaml
├── pom.xml
├── Makefile
├── .gitignore
└── README.md
```
