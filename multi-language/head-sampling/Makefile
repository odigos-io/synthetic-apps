.PHONY: build-nodejs
build-nodejs:
	docker build -f nodejs/deployments/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/multi-language-head-sampling-nodejs:head-sampling nodejs

.PHONY: build-go
build-go:
	docker build -f go/deployments/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/multi-language-head-sampling-go:head-sampling go

.PHONY: build
build:
	make build-nodejs
	make build-go

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/multi-language-head-sampling-nodejs:head-sampling
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/multi-language-head-sampling-go:head-sampling

.PHONY: apply
apply:
	kubectl create namespace multi-language-head-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n multi-language-head-sampling -f deployments/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n multi-language-head-sampling
	kubectl get services -n multi-language-head-sampling

# Deletes any prior run and creates a fresh Job that curls the Node->Go endpoint in-cluster.
.PHONY: trigger-ml-curls
trigger-ml-curls:
	kubectl create namespace multi-language-head-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job ml-head-sampling-curls -n multi-language-head-sampling --ignore-not-found=true
	kubectl apply -n multi-language-head-sampling -f deployments/curl-job.yaml
	kubectl wait --for=condition=complete job/ml-head-sampling-curls -n multi-language-head-sampling --timeout=180s || \
		(kubectl logs job/ml-head-sampling-curls -n multi-language-head-sampling --tail=200; exit 1)
	kubectl logs job/ml-head-sampling-curls -n multi-language-head-sampling

.PHONY: clean
clean:
	kubectl delete namespace multi-language-head-sampling --ignore-not-found=true

