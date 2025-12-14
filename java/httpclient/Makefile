.PHONY: build
build:
	docker build -f deployments/httpclient/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/java-httpclient:httpclient .
	@docker images ghcr.io/odigos-io/synthetic-apps/java-httpclient:httpclient --format "{{.Size}}"

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/java-httpclient:httpclient

.PHONY: apply
apply:
	kubectl create namespace java-httpclient --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n java-httpclient -f deployments/httpclient/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n java-httpclient
	kubectl get services -n java-httpclient

.PHONY: clean
clean:
	kubectl delete namespace java-httpclient --ignore-not-found=true
