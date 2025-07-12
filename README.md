# synthetic-apps
synthetic applications used for testing, developing and evaluating odigos

## Supported Applications

### NodeJS HTTPServer

- `httpserver`: A simple HTTP server application written in NodeJS.
- `versionlatest`: The latest version of NodeJS.
- `versionminimum`: The minimum version of NodeJS odigos supports (14.0.0)
- `versionunsupported`: An unsupported version of NodeJS (12.13.0)
- `versionveryold`: A very old version of NodeJS (8.17.0)
- `envdockerfile`: Set NODE_OPTIONS in dockerfile
- `envmanifest`: Set NODE_OPTIONS in manifest

### Java HTTPServer

- `httpserver`: A simple HTTP server application written in Java (Spring Boot).
- `versionlatest`: The latest version of Java supported by the build system.
- `versionminimum`: The minimum version of Java supported by the build system.
- `envdockerfile`: Set JAVA options in Dockerfile.
- `envmanifest`: Set JAVA options in manifest.

> **Note:** Java 8, released in 2014, is the minimum version supported by OpenTelemetry. Creating applications with older Java versions is not practical or supported, so only Java 8 and newer are included here.

### Python HTTPServer

- `httpserver`: A simple HTTP server application written in Python (Flask).
- `versionlatest`: The latest version of Python (3.x).
- `versionminimum`: The minimum version of Python odigos supports (3.8.0).
- `versionunsupported`: An unsupported version of Python (3.7.17).
- `versionveryold`: A very old version of Python.
- `envdockerfile`: Set Python options in Dockerfile.
- `envmanifest`: Set Python options in manifest.

### Golang HTTPServer

- `httpserver`: A simple HTTP server application written in Go.
- `versionlatest`: The latest version of Go (1.24.5).
- `versionminimum`: The minimum version of Go odigos supports (1.17.1).
- `versionunsupported`: An unsupported version of Go (1.16).

> **Note:** Go 1.17.1 is used as the minimum version instead of 1.17.0 due to a bug in 1.17.0 that prevents odigos from detecting the correct version.
