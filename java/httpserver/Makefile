.PHONY: build
build:
	docker build -f deployments/httpserver/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpserver:httpserver .
	docker build -f deployments/versionlatest/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpserver:versionlatest .
	docker build -f deployments/versionminimum/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpserver:versionminimum .
	docker build -f deployments/versionunsupported/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpserver:versionunsupported .
	docker build -f deployments/versionveryold/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpserver:versionveryold .
	docker build -f deployments/envdockerfile/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpserver:envdockerfile .
	docker build -f deployments/envmanifest/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpserver:envmanifest .
	@docker images ghcr.io/odigos-io/synthetic-apps/java-httpserver:httpserver --format "{{.Size}}"

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpserver:httpserver
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpserver:versionlatest
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpserver:versionminimum
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpserver:versionunsupported
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpserver:versionveryold
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpserver:envdockerfile
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpserver:envmanifest

.PHONY: apply
apply:
	kubectl create namespace java-httpserver --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n java-httpserver -f deployments/httpserver/k8s.yaml
	kubectl apply -n java-httpserver -f deployments/versionlatest/k8s.yaml
	kubectl apply -n java-httpserver -f deployments/versionminimum/k8s.yaml
	kubectl apply -n java-httpserver -f deployments/versionunsupported/k8s.yaml
	kubectl apply -n java-httpserver -f deployments/versionveryold/k8s.yaml
	kubectl apply -n java-httpserver -f deployments/envdockerfile/k8s.yaml
	kubectl apply -n java-httpserver -f deployments/envmanifest/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n java-httpserver
	kubectl get services -n java-httpserver

.PHONY: clean
clean:
	kubectl delete namespace java-httpserver --ignore-not-found=true 