.PHONY: build
build:
	docker build -f deployments/httppayload/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-httppayload:httppayload .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-httppayload:httppayload

.PHONY: apply
apply:
	kubectl create namespace nodejs-httppayload --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-httppayload -f deployments/httppayload/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n nodejs-httppayload
	kubectl get services -n nodejs-httppayload

.PHONY: clean
clean:
	kubectl delete namespace nodejs-httppayload --ignore-not-found=true
