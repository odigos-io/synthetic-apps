.PHONY: build
build:
	docker build -f deployments/aws-sns-sqs/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-aws-sns-sqs:aws-sns-sqs .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-aws-sns-sqs:aws-sns-sqs

.PHONY: apply
apply:
	kubectl create namespace nodejs-aws-sns-sqs --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-aws-sns-sqs -f deployments/aws-sns-sqs/localstack.yaml
	kubectl apply -n nodejs-aws-sns-sqs -f deployments/aws-sns-sqs/k8s.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n nodejs-aws-sns-sqs
	kubectl get services -n nodejs-aws-sns-sqs

.PHONY: clean
clean:
	kubectl delete namespace nodejs-aws-sns-sqs --ignore-not-found=true
