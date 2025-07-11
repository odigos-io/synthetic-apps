.PHONY: build
build:
	docker build -f deployments/httpserver/Dockerfile -t nodejs-httpserver:httpserver .
	docker build -f deployments/versionlatest/Dockerfile -t nodejs-httpserver:versionlatest .
	docker build -f deployments/versionminimum/Dockerfile -t nodejs-httpserver:versionminimum .
	docker build -f deployments/versionunsupported/Dockerfile -t nodejs-httpserver:versionunsupported .
	docker build -f deployments/versionveryold/Dockerfile -t nodejs-httpserver:versionveryold .
	docker build -f deployments/envdockerfile/Dockerfile -t nodejs-httpserver:envdockerfile .
	docker build -f deployments/envmanifest/Dockerfile -t nodejs-httpserver:envmanifest .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image nodejs-httpserver:httpserver
	kind load docker-image nodejs-httpserver:versionlatest
	kind load docker-image nodejs-httpserver:versionminimum
	kind load docker-image nodejs-httpserver:versionunsupported
	kind load docker-image nodejs-httpserver:versionveryold
	kind load docker-image nodejs-httpserver:envdockerfile
	kind load docker-image nodejs-httpserver:envmanifest

.PHONY: deploy-to-kind
deploy-to-kind: build load-to-kind
	kubectl create namespace nodejs-httpserver --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-httpserver -f deployments/httpserver/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/versionlatest/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/versionminimum/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/versionunsupported/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/versionveryold/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/envdockerfile/k8s.yaml
	kubectl apply -n nodejs-httpserver -f deployments/envmanifest/k8s.yaml
	
.PHONY: status
status:
	kubectl get pods -n nodejs-httpserver
	kubectl get services -n nodejs-httpserver

.PHONY: clean
clean:
	kubectl delete namespace nodejs-httpserver --ignore-not-found=true