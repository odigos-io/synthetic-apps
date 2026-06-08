.PHONY: build
build:
	docker build -f deployments/grpc/Dockerfile -t ghcr.io/odigos-io/synthetic-apps/nodejs-grpc:grpc .

.PHONY: load-to-kind
load-to-kind:
	kind load docker-image ghcr.io/odigos-io/synthetic-apps/nodejs-grpc:grpc

.PHONY: apply
apply:
	kubectl create namespace nodejs-grpc --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-grpc -f deployments/grpc-server/proto-configmap.yaml
	kubectl apply -n nodejs-grpc -f deployments/grpc-server/k8s.yaml
	kubectl apply -n nodejs-grpc -f deployments/grpc-server/odigos-instrument.yaml
	kubectl apply -n nodejs-grpc -f deployments/grpc-client/k8s.yaml
	kubectl apply -n nodejs-grpc -f deployments/grpc-client/odigos-instrument.yaml
	kubectl apply -n nodejs-grpc -f deployments/grpc-relay/k8s.yaml
	kubectl apply -n nodejs-grpc -f deployments/grpc-relay/odigos-instrument.yaml

.PHONY: apply-sampling
apply-sampling:
	kubectl apply -n odigos-system -f deployments/grpc-server/sampling.yaml
	kubectl apply -n odigos-system -f deployments/grpc-client/sampling.yaml
	kubectl apply -n odigos-system -f deployments/grpc-relay/sampling.yaml

.PHONY: rollout
rollout:
	kubectl rollout restart deployment/grpc-server deployment/grpc-client deployment/grpc-relay -n nodejs-grpc
	kubectl rollout status deployment/grpc-server -n nodejs-grpc --timeout=120s
	kubectl rollout status deployment/grpc-client -n nodejs-grpc --timeout=120s
	kubectl rollout status deployment/grpc-relay -n nodejs-grpc --timeout=120s

.PHONY: deploy
deploy:
	make build
	make load-to-kind
	make apply
	make rollout

.PHONY: deploy-with-sampling
deploy-with-sampling:
	make deploy
	make apply-sampling

.PHONY: status
status:
	kubectl get pods -n nodejs-grpc
	kubectl get services -n nodejs-grpc

.PHONY: trigger-grpc-server-calls
trigger-grpc-server-calls:
	kubectl create namespace nodejs-grpc --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-grpc -f deployments/grpc-server/proto-configmap.yaml
	kubectl delete job grpc-server-calls -n nodejs-grpc --ignore-not-found=true
	kubectl apply -n nodejs-grpc -f deployments/grpc-server/curl-job.yaml
	kubectl wait --for=condition=complete job/grpc-server-calls -n nodejs-grpc --timeout=180s || \
		(kubectl logs job/grpc-server-calls -n nodejs-grpc --tail=200; exit 1)
	kubectl logs job/grpc-server-calls -n nodejs-grpc

.PHONY: trigger-grpc-relay-calls
trigger-grpc-relay-calls:
	kubectl create namespace nodejs-grpc --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n nodejs-grpc -f deployments/grpc-server/proto-configmap.yaml
	kubectl delete job grpc-relay-calls -n nodejs-grpc --ignore-not-found=true
	kubectl apply -n nodejs-grpc -f deployments/grpc-relay/curl-job.yaml
	kubectl wait --for=condition=complete job/grpc-relay-calls -n nodejs-grpc --timeout=180s || \
		(kubectl logs job/grpc-relay-calls -n nodejs-grpc --tail=200; exit 1)
	kubectl logs job/grpc-relay-calls -n nodejs-grpc

.PHONY: clean
clean:
	kubectl delete namespace nodejs-grpc --ignore-not-found=true
