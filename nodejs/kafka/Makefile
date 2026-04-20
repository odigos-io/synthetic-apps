.PHONY: build
build:
	docker build -f deployments/kafka/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-kafka:kafka .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-kafka:kafka

.PHONY: apply
apply:
	kubectl create namespace nodejs-kafka --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-kafka -f deployments/kafka/kafka.yaml
	kubectl apply -n nodejs-kafka -f deployments/kafka/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n nodejs-kafka
	kubectl get services -n nodejs-kafka

.PHONY: clean
clean:
	kubectl delete namespace nodejs-kafka --ignore-not-found=true
