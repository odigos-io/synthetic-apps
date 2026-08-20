# Java Javalin HTTP Server

A simple Javalin HTTP server. This is a minimal server implementation with no routes - just basic endpoints.

## Features

- **Javalin 5.7.0** - Lightweight web framework
- **Minimal Routes** - Simple health check and root endpoint
- **Multi-stage Docker builds** for clean, architecture-agnostic deployments
- **Kubernetes-ready** deployment configuration

## Endpoints

- `/health` - Health check endpoint (returns "healthy")
- `/` - Root endpoint with status message

## Architecture

- **Java 8** minimum supported version
- **Javalin** for HTTP server functionality
- **Maven** for dependency management and building
- **Docker multi-stage builds** to avoid committing JAR files to git

## Building

```bash
# Build Docker image
make build

# Build specific variant
docker build -f deployments/httpserver-javalin/Dockerfile -t java-httpserver-javalin:test .
```

## Running Locally

```bash
# Build the application
mvn clean package -DskipTests

# Run the JAR
java -jar target/httpserver-javalin-1.0.0.jar
```

## Docker

```bash
# Build and run container
docker build -f deployments/httpserver-javalin/Dockerfile -t java-httpserver-javalin:test .
docker run -d -p 8080:8080 --name java-test java-httpserver-javalin:test

# Test endpoints
curl http://localhost:8080/health
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

- **ARM64 Support**: Uses Java 17 JDK/JRE images for better ARM64 support
- **No JAR files in git**: The `.gitignore` excludes the `target/` directory
- **Multi-stage builds**: Application is built inside Docker containers for architecture consistency
- **Javalin**: Lightweight framework, no Spring Boot dependencies
- **Minimal Routes**: Only health check and root endpoint - no complex routing

## File Structure

```
java/httpserver-javalin/
├── src/
│   └── main/
│       └── java/com/example/httpserverjavalin/
│           └── HttpServerJavalinApplication.java
├── deployments/
│   └── httpserver-javalin/
│       ├── Dockerfile
│       └── k8s.yaml
├── pom.xml
├── Makefile
├── .gitignore
└── README.md
```
