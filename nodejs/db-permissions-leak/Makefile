K8S_NAMESPACE ?= nodejs-db-permissions-leak
IMAGE := ghcr.io/odigos-io/synthetic-apps/nodejs-db-permissions-leak:db-permissions-leak

.PHONY: build load-to-kind apply rollout deploy trigger-traffic stop-traffic trigger-attack status clean
build:
	docker build -f deployments/db-permissions-leak/Dockerfile -t $(IMAGE) .

load-to-kind:
	kind load docker-image $(IMAGE)

apply:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/db-permissions-leak/k8s.yaml
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/db-permissions-leak/odigos-instrument.yaml

rollout:
	kubectl rollout restart deployment/postgres deployment/db-permissions-leak -n $(K8S_NAMESPACE)
	kubectl rollout status deployment/postgres -n $(K8S_NAMESPACE) --timeout=120s
	kubectl rollout status deployment/db-permissions-leak -n $(K8S_NAMESPACE) --timeout=120s

deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) rollout

trigger-traffic:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/db-permissions-leak/traffic-deployment.yaml
	@echo "Legitimate traffic running in deployment/db-permissions-leak-traffic (stop with: make stop-traffic)"

stop-traffic:
	kubectl delete deployment db-permissions-leak-traffic -n $(K8S_NAMESPACE) --ignore-not-found=true

trigger-attack:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job db-permissions-leak-attack -n $(K8S_NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/db-permissions-leak/attack-job.yaml
	kubectl wait --for=condition=complete job/db-permissions-leak-attack -n $(K8S_NAMESPACE) --timeout=120s || \
		(kubectl logs job/db-permissions-leak-attack -n $(K8S_NAMESPACE) --tail=200; exit 1)
	kubectl logs job/db-permissions-leak-attack -n $(K8S_NAMESPACE)

status:
	kubectl get pods -n $(K8S_NAMESPACE)
	kubectl get services -n $(K8S_NAMESPACE)

clean:
	kubectl delete namespace $(K8S_NAMESPACE) --ignore-not-found=true
