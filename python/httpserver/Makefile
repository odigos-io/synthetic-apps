.PHONY: build
build:
	docker build -f deployments/httpserver/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/python-httpserver:httpserver .
	docker build -f deployments/versionlatest/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/python-httpserver:versionlatest .
	docker build -f deployments/versionminimum/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/python-httpserver:versionminimum .
	docker build -f deployments/versionunsupported/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/python-httpserver:versionunsupported .
	docker build -f deployments/versionveryold/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/python-httpserver:versionveryold .
	docker build -f deployments/envdockerfile/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/python-httpserver:envdockerfile .
	docker build -f deployments/envmanifest/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/python-httpserver:envmanifest .
	@docker images ghcr.io/odigos-io/synthetic-apps/python-httpserver:httpserver --format "{{.Size}}"

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/python-httpserver:httpserver
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/python-httpserver:versionlatest
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/python-httpserver:versionminimum
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/python-httpserver:versionunsupported
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/python-httpserver:versionveryold
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/python-httpserver:envdockerfile
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/python-httpserver:envmanifest

.PHONY: apply
apply:
	kubectl create namespace python-httpserver --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n python-httpserver -f deployments/httpserver/k8s.yaml
	kubectl apply -n python-httpserver -f deployments/versionlatest/k8s.yaml
	kubectl apply -n python-httpserver -f deployments/versionminimum/k8s.yaml
	kubectl apply -n python-httpserver -f deployments/versionunsupported/k8s.yaml
	kubectl apply -n python-httpserver -f deployments/versionveryold/k8s.yaml
	kubectl apply -n python-httpserver -f deployments/envdockerfile/k8s.yaml
	kubectl apply -n python-httpserver -f deployments/envmanifest/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n python-httpserver
	kubectl get services -n python-httpserver

.PHONY: clean
clean:
	kubectl delete namespace python-httpserver --ignore-not-found=true
