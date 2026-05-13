.PHONY: build
build:
	docker build -f deployments/head-sampling/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-head-sampling:head-sampling .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-head-sampling:head-sampling

.PHONY: apply
apply:
	kubectl create namespace java-head-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n java-head-sampling -f deployments/head-sampling/k8s.yaml
	kubectl apply -n java-head-sampling -f deployments/http-matching/k8s.yaml
	kubectl apply -n java-head-sampling -f deployments/kubelet-health-probes/k8s.yaml
	kubectl apply -n odigos-system -f deployments/head-sampling/sampling.yaml
	kubectl apply -n odigos-system -f deployments/http-matching/sampling.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n java-head-sampling
	kubectl get services -n java-head-sampling

.PHONY: call-endpoints
call-endpoints:
	./scripts/call-endpoints.sh

.PHONY: call-http-matching-endpoints
call-http-matching-endpoints:
	./scripts/call-http-matching-endpoints.sh

# Deletes any prior run and creates a fresh Job that curls http-matching endpoints in-cluster.
.PHONY: trigger-http-matching-curls
trigger-http-matching-curls:
	kubectl create namespace java-head-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job head-sampling-http-matching-curls -n java-head-sampling --ignore-not-found=true
	kubectl apply -n java-head-sampling -f deployments/http-matching/curl-job.yaml
	kubectl wait --for=condition=complete job/head-sampling-http-matching-curls -n java-head-sampling --timeout=180s || \
		(kubectl logs job/head-sampling-http-matching-curls -n java-head-sampling --tail=200; exit 1)
	kubectl logs job/head-sampling-http-matching-curls -n java-head-sampling

.PHONY: clean
clean:
	kubectl delete namespace java-head-sampling --ignore-not-found=true
