.PHONY: build
build:
	docker build -f deployments/httpserver/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/golang-httpserver:httpserver .
	docker build -f deployments/versionlatest/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/golang-httpserver:versionlatest .
	docker build -f deployments/versionminimum/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/golang-httpserver:versionminimum .
	docker build -f deployments/versionunsupported/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/golang-httpserver:versionunsupported .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/golang-httpserver:httpserver
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/golang-httpserver:versionlatest
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/golang-httpserver:versionminimum
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/golang-httpserver:versionunsupported

.PHONY: apply
apply:
	kubectl create namespace golang-httpserver --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n golang-httpserver -f deployments/httpserver/k8s.yaml
	kubectl apply -n golang-httpserver -f deployments/versionlatest/k8s.yaml
	kubectl apply -n golang-httpserver -f deployments/versionminimum/k8s.yaml
	kubectl apply -n golang-httpserver -f deployments/versionunsupported/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n golang-httpserver
	kubectl get services -n golang-httpserver

.PHONY: clean
clean:
	kubectl delete namespace golang-httpserver --ignore-not-found=true 