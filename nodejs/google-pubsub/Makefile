GCP_PROJECT ?= amir-playground-499009
GCP_SERVICE_ACCOUNT ?= pubsub-synthetic
GCP_SERVICE_ACCOUNT_EMAIL ?= $(GCP_SERVICE_ACCOUNT)@$(GCP_PROJECT).iam.gserviceaccount.com
GCP_KEY_FILE ?= $(CURDIR)/pubsub-synthetic-key.json
K8S_NAMESPACE ?= nodejs-google-pubsub
K8S_SECRET_NAME ?= google-cloud-pubsub-key

.PHONY: create-gcp-service-account
create-gcp-service-account:
	gcloud iam service-accounts describe $(GCP_SERVICE_ACCOUNT_EMAIL) \
		--project=$(GCP_PROJECT) >/dev/null 2>&1 || \
	gcloud iam service-accounts create $(GCP_SERVICE_ACCOUNT) \
		--project=$(GCP_PROJECT)
	gcloud projects add-iam-policy-binding $(GCP_PROJECT) \
		--member="serviceAccount:$(GCP_SERVICE_ACCOUNT_EMAIL)" \
		--role="roles/pubsub.editor"
	@test -f "$(GCP_KEY_FILE)" || \
	gcloud iam service-accounts keys create "$(GCP_KEY_FILE)" \
		--iam-account=$(GCP_SERVICE_ACCOUNT_EMAIL)
	@echo "Service account: $(GCP_SERVICE_ACCOUNT_EMAIL)"
	@echo "Key file: $(GCP_KEY_FILE)"

.PHONY: create-k8s-secret
create-k8s-secret:
	@test -f "$(GCP_KEY_FILE)" || (echo "Missing $(GCP_KEY_FILE). Run: make create-gcp-service-account" && exit 1)
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl create secret generic $(K8S_SECRET_NAME) \
		--from-file=key.json="$(GCP_KEY_FILE)" \
		-n $(K8S_NAMESPACE) \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "Secret $(K8S_SECRET_NAME) applied in namespace $(K8S_NAMESPACE)"

.PHONY: build
build:
	docker build -f deployments/google-pubsub/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-google-pubsub:google-pubsub .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-google-pubsub:google-pubsub

.PHONY: apply
apply:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/google-pubsub/publisher-k8s.yaml
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/google-pubsub/consumer-k8s.yaml
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/google-pubsub/odigos-instrument.yaml

.PHONY: restart
restart:
	kubectl rollout restart deployment/pubsub-publisher deployment/pubsub-consumer -n $(K8S_NAMESPACE)
	kubectl rollout status deployment/pubsub-publisher deployment/pubsub-consumer -n $(K8S_NAMESPACE) --timeout=120s

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) restart

.PHONY: auto-and-deploy
auto-and-deploy:
	$(MAKE) create-gcp-service-account
	$(MAKE) create-k8s-secret
	$(MAKE) deploy

.PHONY: status
status:
	kubectl get pods -n $(K8S_NAMESPACE)
	kubectl get services -n $(K8S_NAMESPACE)

# Deletes any prior run and creates a fresh Job that POSTs /publish/legacy and /publish/publish-message.
.PHONY: trigger trigger-publish
trigger: trigger-publish

trigger-publish:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job pubsub-publisher-publish -n $(K8S_NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/google-pubsub/curl-job.yaml
	kubectl wait --for=condition=complete job/pubsub-publisher-publish -n $(K8S_NAMESPACE) --timeout=180s || \
		(kubectl logs job/pubsub-publisher-publish -n $(K8S_NAMESPACE) --tail=200; exit 1)
	kubectl logs job/pubsub-publisher-publish -n $(K8S_NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(K8S_NAMESPACE) --ignore-not-found=true
