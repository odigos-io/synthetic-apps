# Target kind cluster, e.g. `make deploy KIND=rowan`. When unset, kind uses its
# default cluster and kubectl uses the current context.
KIND ?=
KIND_LOAD := kind load docker-image $(if $(KIND),--name $(KIND))
KUBECTL := kubectl $(if $(KIND),--context kind-$(KIND))

.PHONY: build
build:
	docker build -f deployments/httpserver/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:httpserver .
	docker build -f deployments/versionminimum/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:versionminimum .
	docker build -f deployments/versionunsupported/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:versionunsupported .
	docker build -f deployments/versionveryold/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:versionveryold .
	@docker images ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:httpserver --format "{{.Size}}"

.PHONY: load-to-kind
load-to-kind:
	$(KIND_LOAD) ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:httpserver
	$(KIND_LOAD) ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:versionminimum
	$(KIND_LOAD) ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:versionunsupported
	$(KIND_LOAD) ghcr.io/odigos-io/synthetic-apps/ruby-httpserver:versionveryold

.PHONY: apply
apply:
	$(KUBECTL) create namespace ruby-httpserver --dry-run=client -o yaml | $(KUBECTL) apply -f -
	$(KUBECTL) apply -n ruby-httpserver -f deployments/httpserver/k8s.yaml
	$(KUBECTL) apply -n ruby-httpserver -f deployments/httpserver/odigos-instrument.yaml
	$(KUBECTL) apply -n ruby-httpserver -f deployments/versionminimum/k8s.yaml
	$(KUBECTL) apply -n ruby-httpserver -f deployments/versionminimum/odigos-instrument.yaml
	$(KUBECTL) apply -n ruby-httpserver -f deployments/versionunsupported/k8s.yaml
	$(KUBECTL) apply -n ruby-httpserver -f deployments/versionunsupported/odigos-instrument.yaml
	$(KUBECTL) apply -n ruby-httpserver -f deployments/versionveryold/k8s.yaml
	$(KUBECTL) apply -n ruby-httpserver -f deployments/versionveryold/odigos-instrument.yaml

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply

.PHONY: status
status:
	$(KUBECTL) get pods -n ruby-httpserver
	$(KUBECTL) get services -n ruby-httpserver

.PHONY: clean
clean:
	$(KUBECTL) delete namespace ruby-httpserver --ignore-not-found=true
