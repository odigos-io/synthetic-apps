.PHONY: build
build:
	docker build -f deployments/head-sampling/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/golang-head-sampling:head-sampling .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/golang-head-sampling:head-sampling

.PHONY: apply
apply:
	kubectl create namespace golang-head-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n golang-head-sampling -f deployments/head-sampling/k8s.yaml
	kubectl apply -n golang-head-sampling -f deployments/kubelet-health-probes/k8s.yaml
	kubectl apply -n odigos-system -f deployments/head-sampling/sampling.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n golang-head-sampling
	kubectl get services -n golang-head-sampling

.PHONY: clean
clean:
	kubectl delete namespace golang-head-sampling --ignore-not-found=true
