TAG := multi-containers
NAMESPACE := multi-language-multi-containers
REGISTRY := ghcr.io/odigos-io/synthetic-apps

.PHONY: build
build:
	docker build -f go/Dockerfile -t $(REGISTRY)/multi-language-multi-containers-go:$(TAG) go
	docker build -f nodejs/Dockerfile -t $(REGISTRY)/multi-language-multi-containers-nodejs:$(TAG) nodejs
	docker build -f python/Dockerfile -t $(REGISTRY)/multi-language-multi-containers-python:$(TAG) python
	docker build -f java/Dockerfile -t $(REGISTRY)/multi-language-multi-containers-java:$(TAG) java
	docker build -f cpp/Dockerfile -t $(REGISTRY)/multi-language-multi-containers-cpp:$(TAG) cpp

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image $(REGISTRY)/multi-language-multi-containers-go:$(TAG)
	kind load docker-image $(REGISTRY)/multi-language-multi-containers-nodejs:$(TAG)
	kind load docker-image $(REGISTRY)/multi-language-multi-containers-python:$(TAG)
	kind load docker-image $(REGISTRY)/multi-language-multi-containers-java:$(TAG)
	kind load docker-image $(REGISTRY)/multi-language-multi-containers-cpp:$(TAG)

.PHONY: apply
apply:
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n $(NAMESPACE) -f deployments/k8s.yaml
	kubectl apply -n $(NAMESPACE) -f deployments/odigos-instrument.yaml

.PHONY: deploy
deploy:
	$(MAKE) build
	$(MAKE) load-to-kind
	$(MAKE) apply

.PHONY: status
status:
	kubectl get pods -n $(NAMESPACE) -o wide
	kubectl get deployment ml-multi-containers -n $(NAMESPACE)

.PHONY: clean
clean:
	kubectl delete namespace $(NAMESPACE) --ignore-not-found=true
