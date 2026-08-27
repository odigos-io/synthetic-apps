.PHONY: build
build:
	docker build -f deployments/httpserver-javalin/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpserver-javalin:httpserver-javalin .
	@docker images ghcr.io/odigos-io/synthetic-apps/java-httpserver-javalin:httpserver-javalin --format "{{.Size}}"

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpserver-javalin:httpserver-javalin

.PHONY: apply
apply:
	kubectl create namespace java-httpserver-javalin --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n java-httpserver-javalin -f deployments/httpserver-javalin/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n java-httpserver-javalin
	kubectl get services -n java-httpserver-javalin

.PHONY: clean
clean:
	kubectl delete namespace java-httpserver-javalin --ignore-not-found=true
