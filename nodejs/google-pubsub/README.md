# Node.js Google Pub/Sub

Synthetic app with two workloads:

- **Publisher** (`src/publisher.js`) — publishes JSON messages to Pub/Sub and exposes HTTP publish endpoints
- **Consumer** (`src/consumer.js`) — pulls messages from a subscription, processes them, and acks

Both expose `/healthz` for readiness checks.

The app is designed to work against a fixed GCP Pub/Sub setup used by the test:

- Project: `amir-playground-499009`
- Topics: `legacy-publish-topic`, `publish-message-topic`
- Subscription: `publish-message-subscription` (on `publish-message-topic`)

These values are baked into the code and Kubernetes manifests — no configuration is required.

## Prerequisites

- Node.js 18+ (Node 22 is used in the Docker image)
- `gcloud` logged in (used to create Pub/Sub credentials — workloads run on a local kind cluster, not in GCP)
- `yarn` for local installs
- A kind cluster for Kubernetes deployment

## Auth and deploy

Log in with gcloud, then run the make targets that create a service-account key, upload it to kind as a Secret, and deploy:

```bash
gcloud auth login

cd nodejs/google-pubsub
make auto-and-deploy   # create GCP service account + k8s secret + deploy
make status
```

Auth-only targets (if you need them separately):

```bash
make create-gcp-service-account   # create SA + key file (uses gcloud auth)
make create-k8s-secret            # upload key to cluster as a Secret
```

Other targets:

```bash
make deploy        # build image, load to kind, apply manifests, restart pods
make trigger       # run a one-off publish job against the publisher
make clean         # delete the namespace
```

`deployments/google-pubsub/odigos-instrument.yaml` instruments both deployments and is applied by `make apply` / `make deploy`.

## Run locally

```bash
cd nodejs/google-pubsub
yarn install
gcloud auth application-default login

node src/publisher.js   # terminal 1
node src/consumer.js    # terminal 2
```
