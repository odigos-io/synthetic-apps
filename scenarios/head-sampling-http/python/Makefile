NAMESPACE ?= python-head-sampling

include ../../../depot.mk
include ../scenario.mk

IMAGE := $(DEPOT_REGISTRY)/synthetic-apps:python-head-sampling-http

.PHONY: build
build:
	docker build -f deployments/head-sampling/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply
apply: ensure-namespace
	kubectl apply -n python-head-sampling -f deployments/head-sampling/k8s.yaml
	kubectl apply -n python-head-sampling -f deployments/http-server/k8s.yaml
	kubectl apply -n python-head-sampling -f deployments/http-client/k8s.yaml
	kubectl apply -n python-head-sampling -f deployments/kubelet-health-probes/k8s.yaml
	kubectl apply -n python-head-sampling -f deployments/kubelet-health-probes-query-params/k8s.yaml
	$(MAKE) apply-odigos-sources
	kubectl apply -n odigos-system -f deployments/head-sampling/sampling.yaml
	kubectl apply -n odigos-system -f deployments/http-server/sampling.yaml
	kubectl apply -n odigos-system -f deployments/http-client/sampling.yaml

.PHONY: rollout
rollout:
	kubectl rollout restart deployment/head-sampling deployment/head-sampling-http-server deployment/head-sampling-http-client deployment/kubelet-health-probes deployment/kubelet-health-probes-query-params -n python-head-sampling
	kubectl rollout status deployment/head-sampling -n python-head-sampling --timeout=120s
	kubectl rollout status deployment/head-sampling-http-server -n python-head-sampling --timeout=120s
	kubectl rollout status deployment/head-sampling-http-client -n python-head-sampling --timeout=120s
	kubectl rollout status deployment/kubelet-health-probes -n python-head-sampling --timeout=120s
	kubectl rollout status deployment/kubelet-health-probes-query-params -n python-head-sampling --timeout=120s

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply
	make rollout

.PHONY: status
status:
	kubectl get pods -n python-head-sampling
	kubectl get services -n python-head-sampling

.PHONY: call-endpoints
call-endpoints:
	./scripts/call-endpoints.sh

.PHONY: call-http-server-endpoints
call-http-server-endpoints:
	./scripts/call-http-server-endpoints.sh

.PHONY: trigger-http-server-curls
trigger-http-server-curls: ensure-namespace
	kubectl delete job head-sampling-http-server-curls -n python-head-sampling --ignore-not-found=true
	kubectl apply -n python-head-sampling -f deployments/http-server/curl-job.yaml
	kubectl wait --for=condition=complete job/head-sampling-http-server-curls -n python-head-sampling --timeout=180s || \
		(kubectl logs job/head-sampling-http-server-curls -n python-head-sampling --tail=200; exit 1)
	kubectl logs job/head-sampling-http-server-curls -n python-head-sampling

.PHONY: clean
clean:
	kubectl delete namespace python-head-sampling --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/head-sampling/sampling.yaml --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/http-server/sampling.yaml --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/http-client/sampling.yaml --ignore-not-found=true
