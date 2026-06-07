.PHONY: build
build:
	docker build -f deployments/kafka/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/golang-kafka:kafka .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/golang-kafka:kafka

.PHONY: apply
apply:
	kubectl create namespace golang-kafka --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n golang-kafka -f deployments/kafka/kafka.yaml
	kubectl apply -n golang-kafka -f deployments/kafka/producer-k8s.yaml
	kubectl apply -n golang-kafka -f deployments/kafka/consumer-k8s.yaml
	kubectl apply -n golang-kafka -f deployments/kafka/odigos-instrument.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n golang-kafka
	kubectl get services -n golang-kafka

.PHONY: clean
clean:
	kubectl delete namespace golang-kafka --ignore-not-found=true
