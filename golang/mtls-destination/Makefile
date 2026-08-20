ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

K8S_NAMESPACE ?= golang-mtls-destination
IMAGE := ghcr.io/odigos-io/synthetic-apps/golang-mtls-destination:mtls-destination
KIND_CLUSTER ?= kind
ODIGOS_NS ?= odigos-system

GENERATED := $(ROOT)/.generated
CERTS := $(GENERATED)/certs

.PHONY: help certs certs-force build load-to-kind apply rollout deploy trigger-curls verify status clean

help:
	@echo "Targets:"
	@echo "  make deploy         Certs + build + kind load + apply receiver/app + render Destinations"
	@echo "  make build          Build $(IMAGE)"
	@echo "  make load-to-kind   Load $(IMAGE) into kind cluster $(KIND_CLUSTER)"
	@echo "  make certs          Generate TLS certs under .generated/certs (skipped if present)"
	@echo "  make certs-force    Regenerate TLS certs"
	@echo "  make trigger-curls  Hit /work to generate telemetry"
	@echo "  make verify         openssl s_client check against the in-cluster receiver"
	@echo "  make clean          Delete namespace, destination secrets, and .generated/"
	@echo ""
	@echo "Variables:"
	@echo "  K8S_NAMESPACE=$(K8S_NAMESPACE)"
	@echo "  KIND_CLUSTER=$(KIND_CLUSTER)"
	@echo "  ODIGOS_NS=$(ODIGOS_NS)"

certs:
	@if [ -f $(CERTS)/ca.crt ]; then \
		echo "==> Using existing certs in $(CERTS)"; \
	else \
		NAMESPACE=$(K8S_NAMESPACE) $(ROOT)/scripts/gen-certs.sh; \
	fi

certs-force:
	rm -rf $(CERTS)
	NAMESPACE=$(K8S_NAMESPACE) $(ROOT)/scripts/gen-certs.sh

build:
	docker build -f deployments/mtls-destination/Dockerfile -t $(IMAGE) .

load-to-kind:
	kind load docker-image $(IMAGE) --name $(KIND_CLUSTER)

apply:
	IMAGE=$(IMAGE) KIND_CLUSTER= NAMESPACE=$(K8S_NAMESPACE) ODIGOS_NS=$(ODIGOS_NS) \
		$(ROOT)/scripts/setup.sh --odigos-ns $(ODIGOS_NS)

rollout:
	kubectl rollout restart deployment/mtls-destination -n $(K8S_NAMESPACE)
	kubectl rollout status deployment/mtls-destination -n $(K8S_NAMESPACE) --timeout=120s

deploy: certs build load-to-kind
	IMAGE=$(IMAGE) KIND_CLUSTER=$(KIND_CLUSTER) NAMESPACE=$(K8S_NAMESPACE) ODIGOS_NS=$(ODIGOS_NS) \
		$(ROOT)/scripts/setup.sh --odigos-ns $(ODIGOS_NS) --kind-cluster $(KIND_CLUSTER)

trigger-curls:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job mtls-destination-curls -n $(K8S_NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/mtls-destination/curl-job.yaml
	kubectl wait --for=condition=complete job/mtls-destination-curls -n $(K8S_NAMESPACE) --timeout=120s || \
		(kubectl logs job/mtls-destination-curls -n $(K8S_NAMESPACE) --tail=200; exit 1)
	kubectl logs job/mtls-destination-curls -n $(K8S_NAMESPACE)

verify:
	NAMESPACE=$(K8S_NAMESPACE) $(ROOT)/scripts/verify-mtls.sh

status:
	kubectl get pods -n $(K8S_NAMESPACE)
	kubectl get services -n $(K8S_NAMESPACE)

clean:
	-kubectl -n $(ODIGOS_NS) delete destination otlp-mtls otlp-mtls-dynamic --ignore-not-found
	-kubectl -n $(ODIGOS_NS) delete secret otlp-mtls-certs otlp-mtls-dynamic-certs --ignore-not-found
	-kubectl delete namespace $(K8S_NAMESPACE) --ignore-not-found
	rm -rf $(GENERATED)
