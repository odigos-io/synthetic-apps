K8S_NAMESPACE ?= java-custom-instrumentation-args
IMAGE := ghcr.io/odigos-io/synthetic-apps/java-custom-instrumentation-args:custom-instrumentation
DEPLOY_DIR := deployments/custom-instrumentation-args

.PHONY: build load-to-kind apply rollout deploy trigger-baseline trigger-attack status clean

build:
	docker build -f $(DEPLOY_DIR)/Dockerfile -t $(IMAGE) .

load-to-kind:
	kind load docker-image $(IMAGE)

apply:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(K8S_NAMESPACE) -f $(DEPLOY_DIR)/k8s.yaml
	kubectl apply -n $(K8S_NAMESPACE) -f $(DEPLOY_DIR)/odigos-instrument.yaml
	kubectl apply -n odigos-system -f $(DEPLOY_DIR)/instrumentation-rule.yaml

rollout:
	kubectl rollout restart deployment/custom-instrumentation-args -n $(K8S_NAMESPACE)
	kubectl rollout status deployment/custom-instrumentation-args -n $(K8S_NAMESPACE) --timeout=180s

deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) rollout

# Normal, well-shaped traffic to build (and promote) the D4 argument profiles.
trigger-baseline:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job custom-instrumentation-args-baseline -n $(K8S_NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(K8S_NAMESPACE) -f $(DEPLOY_DIR)/curl-job.yaml
	kubectl wait --for=condition=complete job/custom-instrumentation-args-baseline -n $(K8S_NAMESPACE) --timeout=300s || \
		(kubectl logs job/custom-instrumentation-args-baseline -n $(K8S_NAMESPACE) --tail=200; exit 1)
	kubectl logs job/custom-instrumentation-args-baseline -n $(K8S_NAMESPACE)

# Malformed / out-of-profile arguments to trip the D4 scorer (run AFTER promotion).
trigger-attack:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job custom-instrumentation-args-attack -n $(K8S_NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(K8S_NAMESPACE) -f $(DEPLOY_DIR)/attack-job.yaml
	kubectl wait --for=condition=complete job/custom-instrumentation-args-attack -n $(K8S_NAMESPACE) --timeout=120s || \
		(kubectl logs job/custom-instrumentation-args-attack -n $(K8S_NAMESPACE) --tail=200; exit 1)
	kubectl logs job/custom-instrumentation-args-attack -n $(K8S_NAMESPACE)

status:
	kubectl get pods -n $(K8S_NAMESPACE)
	kubectl get services -n $(K8S_NAMESPACE)

clean:
	kubectl delete -n odigos-system instrumentationrule custom-instrumentation-args --ignore-not-found=true
	kubectl delete namespace $(K8S_NAMESPACE) --ignore-not-found=true
