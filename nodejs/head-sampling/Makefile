.PHONY: build
build:
	docker build -f deployments/head-sampling/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-head-sampling:head-sampling .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-head-sampling:head-sampling

.PHONY: apply
apply:
	kubectl create namespace nodejs-head-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-head-sampling -f deployments/head-sampling/k8s.yaml
	kubectl apply -n nodejs-head-sampling -f deployments/http-server/k8s.yaml
	kubectl apply -n nodejs-head-sampling -f deployments/http-client/k8s.yaml
	kubectl apply -n nodejs-head-sampling -f deployments/kubelet-health-probes/k8s.yaml
	kubectl apply -n odigos-system -f deployments/head-sampling/sampling.yaml
	kubectl apply -n odigos-system -f deployments/http-server/sampling.yaml
	kubectl apply -n odigos-system -f deployments/http-client/sampling.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n nodejs-head-sampling
	kubectl get services -n nodejs-head-sampling

.PHONY: call-endpoints
call-endpoints:
	./scripts/call-endpoints.sh

.PHONY: call-http-server-endpoints
call-http-server-endpoints:
	./scripts/call-http-server-endpoints.sh

# Deletes any prior run and creates a fresh Job that curls http-server endpoints in-cluster.
.PHONY: trigger-http-server-curls
trigger-http-server-curls:
	kubectl create namespace nodejs-head-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job head-sampling-http-server-curls -n nodejs-head-sampling --ignore-not-found=true
	kubectl apply -n nodejs-head-sampling -f deployments/http-server/curl-job.yaml
	kubectl wait --for=condition=complete job/head-sampling-http-server-curls -n nodejs-head-sampling --timeout=180s || \
		(kubectl logs job/head-sampling-http-server-curls -n nodejs-head-sampling --tail=200; exit 1)
	kubectl logs job/head-sampling-http-server-curls -n nodejs-head-sampling

.PHONY: clean
clean:
	kubectl delete namespace nodejs-head-sampling --ignore-not-found=true
