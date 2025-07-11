# Environment Deployment

This type of deployment is meant to test the application with various environment configurations, ensuring that the application behaves correctly when different environment variables and runtime options are applied.

## Requirements

- The application MUST validate that environment variables are properly applied
- The application MUST verify that runtime options (like `--require` and `--max-old-space-size`) are correctly set
- The application MUST fail fast if required environment configurations are not present

## Deployment Types

### Environment Manifest (envmanifest)

Environment variables are configured through the Kubernetes manifest (k8s.yaml). This tests that:
- Environment variables set in the Kubernetes deployment are properly passed to the container
- The application can read and validate environment variables from the Kubernetes environment
- Runtime options like `NODE_OPTIONS` are correctly applied when set via Kubernetes

### Environment Dockerfile (envdockerfile)

Environment variables are configured directly in the Dockerfile. This tests that:
- Environment variables set in the Dockerfile are properly available at runtime
- The application can read and validate environment variables from the container environment
- Runtime options like `NODE_OPTIONS` are correctly applied when set via Dockerfile

## Use Cases

Helps to verify that after odigos is deployed, the application is able to read the environment variables and runtime options correctly as if odigos was not there.
