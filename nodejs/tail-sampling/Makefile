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

.PHONY: clean
clean:
	kubectl delete namespace nodejs-tail-sampling --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/tail-sampling/sampling.yaml --ignore-not-found=true
