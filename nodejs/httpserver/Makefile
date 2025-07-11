.PHONY: build
build:
	docker build -f deployments/httpserver/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:httpserver .
	docker build -f deployments/versionlatest/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:versionlatest .
	docker build -f deployments/versionminimum/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:versionminimum .
	docker build -f deployments/versionunsupported/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:versionunsupported .
	docker build -f deployments/versionveryold/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:versionveryold .
	docker build -f deployments/envdockerfile/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:envdockerfile .
	docker build -f deployments/envmanifest/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:envmanifest .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:httpserver
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:versionlatest
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:versionminimum
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:versionunsupported
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:versionveryold
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:envdockerfile
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-httpserver:envmanifest

.PHONY: apply
apply:
	kubectl create namespace nodejs-httpserver --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-httpserver -f deployments/httpserver/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/versionlatest/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/versionminimum/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/versionunsupported/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/versionveryold/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/envdockerfile/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/envmanifest/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n nodejs-httpserver
	kubectl get services -n nodejs-httpserver

.PHONY: clean
clean:
	kubectl delete namespace nodejs-httpserver --ignore-not-found=true