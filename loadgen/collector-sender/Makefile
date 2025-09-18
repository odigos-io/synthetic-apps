.PHONY: build
build:
	docker build -f deployments/default/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/loadgen-default:collector-sender .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/loadgen-default:collector-sender

.PHONY: apply
apply:
	kubectl create namespace loadgen-default --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n loadgen-default -f deployments/default/k8s.yaml
	kubectl rollout restart deployment loadgen-collector-sender -n loadgen-default

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply
