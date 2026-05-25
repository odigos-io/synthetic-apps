NAMESPACE := nodejs-workload-types
IMAGE := ghcr.io/odigos-io/synthetic-apps/nodejs-workload-types:workload-types
WORKLOADS := deployment daemonset statefulset cronjob

.PHONY: build
build:
	docker build -f deployments/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply
apply:
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@for w in $(WORKLOADS); do \
		kubectl apply -n $(NAMESPACE) -f deployments/$$w/k8s.yaml; \
		kubectl apply -n $(NAMESPACE) -f deployments/$$w/odigos-instrument.yaml; \
	done

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply

.PHONY: status
status:
	kubectl get deployments,daemonsets,statefulsets,cronjobs -n $(NAMESPACE)
	kubectl get pods -n $(NAMESPACE) -o wide
	kubectl get jobs -n $(NAMESPACE) --sort-by=.metadata.creationTimestamp | tail -5

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
