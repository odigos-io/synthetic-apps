.PHONY: build
build:
	docker build -f deployments/tail-sampling/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-tail-sampling:tail-sampling .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-tail-sampling:tail-sampling

.PHONY: apply
apply:
	kubectl create namespace nodejs-tail-sampling --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-tail-sampling -f deployments/errors/k8s.yaml
	kubectl apply -n nodejs-tail-sampling -f deployments/errors/odigos-instrument.yaml
	kubectl apply -n nodejs-tail-sampling -f deployments/duration/k8s.yaml
	kubectl apply -n nodejs-tail-sampling -f deployments/duration/odigos-instrument.yaml
	kubectl apply -n nodejs-tail-sampling -f deployments/tail-sampling/k8s.yaml
	kubectl apply -n nodejs-tail-sampling -f deployments/tail-sampling/odigos-instrument.yaml
	kubectl apply -n odigos-system -f deployments/errors/sampling.yaml
	kubectl apply -n odigos-system -f deployments/duration/sampling.yaml
	kubectl apply -n odigos-system -f deployments/tail-sampling/sampling.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	kubectl get pods -n nodejs-tail-sampling
	kubectl get services -n nodejs-tail-sampling

.PHONY: call-endpoints
call-endpoints:
	./scripts/call-endpoints.sh

.PHONY: call-errors-endpoints
call-errors-endpoints:
	./scripts/call-errors-endpoints.sh

.PHONY: call-duration-endpoints
call-duration-endpoints:
	./scripts/call-duration-endpoints.sh

# Deletes any prior run and creates fresh Jobs that curl all deployment endpoints in-cluster.
.PHONY: trigger
trigger:
	kubectl create namespace nodejs-tail-sampling --dry-run=client -o yaml | kubectl apply -f -
	$(MAKE) trigger-job JOB=tail-sampling-curls MANIFEST=deployments/tail-sampling/curl-job.yaml TIMEOUT=300s
	$(MAKE) trigger-job JOB=tail-sampling-errors-curls MANIFEST=deployments/errors/curl-job.yaml TIMEOUT=180s
	$(MAKE) trigger-job JOB=tail-sampling-duration-curls MANIFEST=deployments/duration/curl-job.yaml TIMEOUT=300s

.PHONY: trigger-job
trigger-job:
ifndef JOB
	@$(MAKE) trigger
else
ifndef MANIFEST
	$(error trigger-job requires MANIFEST=... and TIMEOUT=... (or run 'make trigger'))
endif
ifndef TIMEOUT
	$(error trigger-job requires TIMEOUT=... (or run 'make trigger'))
endif
	kubectl delete job $(JOB) -n nodejs-tail-sampling --ignore-not-found=true
	kubectl apply -n nodejs-tail-sampling -f $(MANIFEST)
	kubectl wait --for=condition=complete job/$(JOB) -n nodejs-tail-sampling --timeout=$(TIMEOUT) || \
		(kubectl logs job/$(JOB) -n nodejs-tail-sampling --tail=200; exit 1)
	kubectl logs job/$(JOB) -n nodejs-tail-sampling
endif

.PHONY: clean
clean:
	kubectl delete namespace nodejs-tail-sampling --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/tail-sampling/sampling.yaml --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/errors/sampling.yaml --ignore-not-found=true
	kubectl delete -n odigos-system -f deployments/duration/sampling.yaml --ignore-not-found=true
