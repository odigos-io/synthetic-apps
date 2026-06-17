K8S_NAMESPACE ?= golang-custom-instrumentation
IMAGE := ghcr.io/odigos-io/synthetic-apps/golang-custom-instrumentation:custom-instrumentation

.PHONY: build load-to-kind apply rollout deploy trigger-curls status clean
build:
	docker build -f deployments/custom-instrumentation/Dockerfile -t $(IMAGE) .

load-to-kind:
	kind load docker-image $(IMAGE)

apply:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/custom-instrumentation/k8s.yaml
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/custom-instrumentation/odigos-instrument.yaml
	kubectl apply -n odigos-system -f deployments/custom-instrumentation/instrumentation-rule.yaml

rollout:
	kubectl rollout restart deployment/custom-instrumentation -n $(K8S_NAMESPACE)
	kubectl rollout status deployment/custom-instrumentation -n $(K8S_NAMESPACE) --timeout=120s

deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) rollout

trigger-curls:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job custom-instrumentation-curls -n $(K8S_NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/custom-instrumentation/curl-job.yaml
	kubectl wait --for=condition=complete job/custom-instrumentation-curls -n $(K8S_NAMESPACE) --timeout=120s || \
		(kubectl logs job/custom-instrumentation-curls -n $(K8S_NAMESPACE) --tail=200; exit 1)
	kubectl logs job/custom-instrumentation-curls -n $(K8S_NAMESPACE)

status:
	kubectl get pods -n $(K8S_NAMESPACE)
	kubectl get services -n $(K8S_NAMESPACE)

clean:
	kubectl delete -n odigos-system instrumentationrule custom-instrumentation-fetch-value --ignore-not-found=true
	kubectl delete namespace $(K8S_NAMESPACE) --ignore-not-found=true
