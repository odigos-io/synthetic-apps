NAMESPACE ?= java-cassandra

include ../../../depot.mk
include ../scenario.mk

IMAGE := $(DEPOT_REGISTRY)/synthetic-apps:java-cassandra

.PHONY: build
build:
	docker build -f deployments/cassandra/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply
apply: ensure-namespace
	kubectl apply -n $(NAMESPACE) -f deployments/cassandra/k8s.yaml
	$(MAKE) apply-odigos-sources
	$(MAKE) apply-payload-collection

.PHONY: apply-payload-collection
apply-payload-collection:
	kubectl apply -n odigos-system -f deployments/cassandra/payload-collection-rule.yaml

.PHONY: rollout
rollout:
	# Restart cassandra-db first and wait — app schema init races if both come up together.
	kubectl rollout restart deployment/cassandra-db -n $(NAMESPACE)
	kubectl rollout status deployment/cassandra-db -n $(NAMESPACE) --timeout=300s
	kubectl rollout restart deployment/cassandra -n $(NAMESPACE)
	kubectl rollout status deployment/cassandra -n $(NAMESPACE) --timeout=300s

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) rollout

.PHONY: status
status:
	kubectl get pods -n $(NAMESPACE) -o wide
	kubectl get deployments -n $(NAMESPACE)
	kubectl get services -n $(NAMESPACE)

# Deletes any prior run and creates a fresh Job that GETs /query.
.PHONY: trigger trigger-cassandra-curls
trigger: trigger-cassandra-curls

trigger-cassandra-curls: ensure-namespace
	kubectl delete job cassandra-curls -n $(NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(NAMESPACE) -f deployments/cassandra/curl-job.yaml
	kubectl wait --for=condition=complete job/cassandra-curls -n $(NAMESPACE) --timeout=180s || \
		(kubectl logs job/cassandra-curls -n $(NAMESPACE) --tail=200; exit 1)
	kubectl logs job/cassandra-curls -n $(NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/cassandra/payload-collection-rule.yaml --ignore-not-found=true
