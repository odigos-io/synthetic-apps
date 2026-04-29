.PHONY: build
build:
	docker build -f deployments/tail-sampling/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-tail-sampling:tail-sampling .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-tail-sampling:tail-sampling

.PHONY: apply
apply:
	kubectl create namespace nodejs-tail-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-tail-sampling -f deployments/tail-sampling/k8s.yaml
	kubectl apply -n odigos-system -f deployments/tail-sampling/sampling.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n nodejs-tail-sampling
	kubectl get services -n nodejs-tail-sampling

.PHONY: call-endpoints
call-endpoints:
	./scripts/call-endpoints.sh

# Deletes any prior run and creates a fresh Job that curls tail-sampling endpoints in-cluster.
.PHONY: trigger-tail-sampling-curls
trigger-tail-sampling-curls:
	kubectl create namespace nodejs-tail-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job tail-sampling-curls -n nodejs-tail-sampling --ignore-not-found=true
	kubectl apply -n nodejs-tail-sampling -f deployments/tail-sampling/curl-job.yaml
	kubectl wait --for=condition=complete job/tail-sampling-curls -n nodejs-tail-sampling --timeout=300s || \
		(kubectl logs job/tail-sampling-curls -n nodejs-tail-sampling --tail=200; exit 1)
	kubectl logs job/tail-sampling-curls -n nodejs-tail-sampling

# Sample run: one request per scenario, prints response bodies to Job logs (kubectl logs).
.PHONY: trigger-tail-sampling-sample
trigger-tail-sampling-sample:
	kubectl create namespace nodejs-tail-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job tail-sampling-curl-sample -n nodejs-tail-sampling --ignore-not-found=true
	kubectl apply -n nodejs-tail-sampling -f deployments/tail-sampling/curl-sample-job.yaml
	kubectl wait --for=condition=complete job/tail-sampling-curl-sample -n nodejs-tail-sampling --timeout=180s || \
		(kubectl logs job/tail-sampling-curl-sample -n nodejs-tail-sampling --tail=200; exit 1)
	kubectl logs job/tail-sampling-curl-sample -n nodejs-tail-sampling

.PHONY: clean
clean:
	kubectl delete namespace nodejs-tail-sampling --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/tail-sampling/sampling.yaml --ignore-not-found=true
