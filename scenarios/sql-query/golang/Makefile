NAMESPACE ?= golang-sql-query

include ../../../depot.mk
include ../scenario.mk

IMAGE := $(DEPOT_REGISTRY)/synthetic-apps:golang-sql-query

.PHONY: build
build:
	docker build -f deployments/sql-query/Dockerfile -t $(IMAGE) .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(IMAGE)

.PHONY: apply
apply: ensure-namespace
	kubectl apply -n $(NAMESPACE) -f deployments/sql-query/k8s.yaml
	$(MAKE) apply-odigos-sources
	$(MAKE) apply-payload-collection

.PHONY: apply-payload-collection
apply-payload-collection:
	kubectl apply -n odigos-system -f deployments/sql-query/payload-collection-rule.yaml

.PHONY: rollout
rollout:
	# Restart postgres first and wait — app schema init races if both come up together.
	kubectl rollout restart deployment/postgres -n $(NAMESPACE)
	kubectl rollout status deployment/postgres -n $(NAMESPACE) --timeout=120s
	kubectl rollout restart deployment/sql-query -n $(NAMESPACE)
	kubectl rollout status deployment/sql-query -n $(NAMESPACE) --timeout=120s

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
.PHONY: trigger trigger-sql-query-curls
trigger: trigger-sql-query-curls

trigger-sql-query-curls: ensure-namespace
	kubectl delete job sql-query-curls -n $(NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(NAMESPACE) -f deployments/sql-query/curl-job.yaml
	kubectl wait --for=condition=complete job/sql-query-curls -n $(NAMESPACE) --timeout=180s || \
		(kubectl logs job/sql-query-curls -n $(NAMESPACE) --tail=200; exit 1)
	kubectl logs job/sql-query-curls -n $(NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/sql-query/payload-collection-rule.yaml --ignore-not-found=true
