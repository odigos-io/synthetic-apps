K8S_NAMESPACE ?= java-log4shell
IMAGE_APP := ghcr.io/odigos-io/synthetic-apps/java-log4shell:log4shell
IMAGE_HTTP := ghcr.io/odigos-io/synthetic-apps/java-log4shell:exploit-http
IMAGE_LDAP := ghcr.io/odigos-io/synthetic-apps/java-log4shell:exploit-ldap
IMAGE_CALLBACK := ghcr.io/odigos-io/synthetic-apps/java-log4shell:exploit-callback

.PHONY: build load-to-kind apply rollout deploy trigger-traffic stop-traffic trigger-attack verify-attack status clean
build:
	docker build -f deployments/log4shell/Dockerfile -t $(IMAGE_APP) .
	docker build -f deployments/exploit-http/Dockerfile -t $(IMAGE_HTTP) .
	docker build -f deployments/exploit-ldap/Dockerfile -t $(IMAGE_LDAP) .
	docker build -f deployments/exploit-callback/Dockerfile -t $(IMAGE_CALLBACK) .

load-to-kind:
	kind load docker-image $(IMAGE_APP)
	kind load docker-image $(IMAGE_HTTP)
	kind load docker-image $(IMAGE_LDAP)
	kind load docker-image $(IMAGE_CALLBACK)

apply:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/log4shell/k8s.yaml
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/log4shell/odigos-instrument.yaml

rollout:
	kubectl rollout restart deployment/postgres deployment/log4shell deployment/log4shell-http deployment/log4shell-ldap deployment/log4shell-callback -n $(K8S_NAMESPACE)
	kubectl rollout status deployment/postgres -n $(K8S_NAMESPACE) --timeout=120s
	kubectl rollout status deployment/log4shell-http -n $(K8S_NAMESPACE) --timeout=120s
	kubectl rollout status deployment/log4shell-ldap -n $(K8S_NAMESPACE) --timeout=180s
	kubectl rollout status deployment/log4shell-callback -n $(K8S_NAMESPACE) --timeout=120s
	kubectl rollout status deployment/log4shell -n $(K8S_NAMESPACE) --timeout=180s

deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply
	$(MAKE) rollout

trigger-traffic:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/log4shell/traffic-deployment.yaml
	@echo "Legitimate traffic running in deployment/log4shell-traffic (stop with: make stop-traffic)"

stop-traffic:
	kubectl delete deployment log4shell-traffic -n $(K8S_NAMESPACE) --ignore-not-found=true

trigger-attack:
	kubectl create namespace $(K8S_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl delete job log4shell-attack -n $(K8S_NAMESPACE) --ignore-not-found=true
	kubectl apply -n $(K8S_NAMESPACE) -f deployments/log4shell/attack-job.yaml
	kubectl wait --for=condition=complete job/log4shell-attack -n $(K8S_NAMESPACE) --timeout=180s || \
		(kubectl logs job/log4shell-attack -n $(K8S_NAMESPACE) --tail=200; exit 1)
	kubectl logs job/log4shell-attack -n $(K8S_NAMESPACE)
	@$(MAKE) verify-attack

verify-attack:
	@echo "=== log4shell app (remote class load) ==="
	@kubectl logs deployment/log4shell -n $(K8S_NAMESPACE) --tail=30 | grep -F "LOG4SHELL DEMO" || true
	@echo "=== log4shell-http (class download) ==="
	@kubectl logs deployment/log4shell-http -n $(K8S_NAMESPACE) --tail=20 | grep -F "DemoExploit.class" || true
	@echo "=== log4shell-callback (post-exploit HTTP) ==="
	@kubectl logs deployment/log4shell-callback -n $(K8S_NAMESPACE) --tail=20 | grep -F "CALLBACK HIT" || true

status:
	kubectl get pods -n $(K8S_NAMESPACE)
	kubectl get services -n $(K8S_NAMESPACE)

clean:
	kubectl delete namespace $(K8S_NAMESPACE) --ignore-not-found=true
