K8S_NAMESPACE ?= claims-demo
ODIGOS_NAMESPACE ?= odigos-system
IMAGE ?= ghcr.io/odigos-io/synthetic-apps/java-claims-intake:latest
PLATFORM ?= linux/amd64
DEPLOY_DIR := deployments/claims-intake
RULE_NAME := odig-int-$(K8S_NAMESPACE)-claims-intake

# Same access path as odigos-enterprise/insights/CLICKHOUSE_DEBUG.md, on the interrogation database.
CH_CLIENT = kubectl exec -n $(ODIGOS_NAMESPACE) deploy/odigos-insights-clickhouse -- clickhouse-client \
	-u odigos_insights \
	--password "$$(kubectl get secret odigos-insights-clickhouse -n $(ODIGOS_NAMESPACE) -o jsonpath='{.data.password}' | base64 -d)" \
	-d interrogation

# Interrogation call tries live in Redis DB 1 of the shared odigos-cache.
REDIS_CLIENT = kubectl exec -n $(ODIGOS_NAMESPACE) deploy/odigos-cache -- redis-cli -n 1

RUNS_SQL = SELECT r.Timestamp AS at, t.RootSpanName AS transaction, r.ApplyStatus AS status, \
	JSONExtractString(rec, 'category') AS category, JSONExtractString(rec, 'function') AS function, \
	JSONExtractString(rec, 'why') AS why, r.Error AS error \
	FROM tx_runs AS r \
	LEFT ARRAY JOIN JSONExtractArrayRaw(r.Parsed, 'recommendations') AS rec \
	LEFT JOIN (SELECT DISTINCT TransactionId, RootSpanName FROM tx_transactions WHERE Namespace = '$(K8S_NAMESPACE)') AS t \
	ON r.TransactionId = t.TransactionId \
	WHERE r.Namespace = '$(K8S_NAMESPACE)' ORDER BY r.Timestamp FORMAT Vertical

.PHONY: build push load-to-kind apply rollout deploy loadgen loadgen-stop release-2.4 rollback-2.4 features probes probes-yaml runs reset-probes status clean

build:
	docker build -f $(DEPLOY_DIR)/Dockerfile -t $(IMAGE) .

# For remote clusters: make push apply rollout IMAGE=docker.io/<you>/java-claims-intake:latest
push:
	docker buildx build --platform $(PLATFORM) -f $(DEPLOY_DIR)/Dockerfile -t $(IMAGE) --push .

load-to-kind:
	kind load docker-image $(IMAGE)

apply:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(K8S_NAMESPACE) -f $(DEPLOY_DIR)/k8s.yaml
	kubectl set image -n $(K8S_NAMESPACE) deployment/claims-intake claims-intake=$(IMAGE)
	kubectl apply -n $(K8S_NAMESPACE) -f $(DEPLOY_DIR)/odigos-instrument.yaml

rollout:
	kubectl rollout restart deployment/claims-intake -n $(K8S_NAMESPACE)
	kubectl rollout status deployment/claims-intake -n $(K8S_NAMESPACE) --timeout=180s

deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) rollout

loadgen:
	kubectl apply -n $(K8S_NAMESPACE) -f $(DEPLOY_DIR)/loadgen.yaml

loadgen-stop:
	kubectl delete -n $(K8S_NAMESPACE) -f $(DEPLOY_DIR)/loadgen.yaml --ignore-not-found=true

# Ships the "2.4 release" (fraud ring detection) without a redeploy.
# In-process state: it resets to FRAUD_RING_DETECTION on restart.
release-2.4:
	kubectl exec -n $(K8S_NAMESPACE) deploy/claims-intake-loadgen -- \
		curl -sS -X POST "http://claims-intake:8080/admin/features/fraud-ring-detection?enabled=true"; echo

rollback-2.4:
	kubectl exec -n $(K8S_NAMESPACE) deploy/claims-intake-loadgen -- \
		curl -sS -X POST "http://claims-intake:8080/admin/features/fraud-ring-detection?enabled=false"; echo

features:
	kubectl exec -n $(K8S_NAMESPACE) deploy/claims-intake-loadgen -- \
		curl -sS "http://claims-intake:8080/admin/features"; echo

# Probes the interrogation loop has applied to this workload, one per line.
probes:
	@kubectl get instrumentationrule $(RULE_NAME) -n $(ODIGOS_NAMESPACE) \
		-o jsonpath='{range .spec.customInstrumentations.java[*]}{.className}{"."}{.methodName}{"\n"}{end}' 2>/dev/null \
		|| echo "no interrogation rule for claims-intake yet"

# The full rule, including the model's category and justification for each probe.
probes-yaml:
	kubectl get instrumentationrule $(RULE_NAME) -n $(ODIGOS_NAMESPACE) -o yaml

# Every analysis the loop ran for this namespace, one row per recommendation. Works in dry-run mode too.
runs:
	$(CH_CLIENT) --query "$(RUNS_SQL)"

# Forgets generated probes, past analyses and the learned call tries, then restarts
# the app so the Java agent drops already-instrumented methods. Interrogation re-learns
# from live traffic, so the first probes land again after about 5 minutes.
# Redis is cleared before ClickHouse so the trie flusher can't copy old nodes back.
# Trie keys are <prefix><namespace>\x1f...; '?' matches the \x1f separator.
reset-probes:
	kubectl delete instrumentationrule $(RULE_NAME) -n $(ODIGOS_NAMESPACE) --ignore-not-found=true
	@echo "deleted Redis call tries: $$($(REDIS_CLIENT) EVAL "local ks = redis.call('KEYS', ARGV[1]) for _, k in ipairs(ks) do redis.call('DEL', k) end return #ks" 0 'odigos:interrogation:trie:$(K8S_NAMESPACE)?*')"
	$(CH_CLIENT) --query "ALTER TABLE tx_call_trie_structure DELETE WHERE Namespace = '$(K8S_NAMESPACE)' SETTINGS mutations_sync = 1"
	$(CH_CLIENT) --query "ALTER TABLE tx_runs DELETE WHERE Namespace = '$(K8S_NAMESPACE)' SETTINGS mutations_sync = 1"
	$(MAKE) rollout

status:
	kubectl get pods -n $(K8S_NAMESPACE)
	kubectl get services -n $(K8S_NAMESPACE)

clean:
	kubectl delete instrumentationrule $(RULE_NAME) -n $(ODIGOS_NAMESPACE) --ignore-not-found=true
	kubectl delete namespace $(K8S_NAMESPACE) --ignore-not-found=true
