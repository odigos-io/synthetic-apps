ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
DEPLOY := $(ROOT)deploy.sh

# Number of backend stacks to deploy (1–5): redis, kafka, postgres, messaging, search
STACKS ?= 5

TRAFFIC_REPLICAS ?= 10
TRAFFIC_DURATION_SECONDS ?= 3600
TRAFFIC_PARALLEL ?= 6
TRAFFIC_ITERATIONS ?= 1000
TRAFFIC_WORKERS ?= 20

export STACKS
export TRAFFIC_REPLICAS TRAFFIC_DURATION_SECONDS TRAFFIC_PARALLEL TRAFFIC_ITERATIONS TRAFFIC_WORKERS

.PHONY: build load-to-kind apply rollout deploy status clean trigger-traffic trigger-traffic-burst stop-traffic traffic-status help

help:
	@echo "Stacks synthetic-apps deploy (STACKS=1-5, default 5)"
	@echo ""
	@echo "  make deploy STACKS=2     gateway + redis + kafka"
	@echo "  make deploy STACKS=5     all stacks (default)"
	@echo ""
	@echo "Stack order: redis → kafka → postgres → messaging → search"
	@echo ""
	@echo "Targets: build load-to-kind apply rollout deploy status clean"
	@echo "         trigger-traffic trigger-traffic-burst stop-traffic traffic-status"

build:
	$(DEPLOY) build

load-to-kind:
	$(DEPLOY) load-to-kind

apply:
	$(DEPLOY) apply

rollout:
	$(DEPLOY) rollout

deploy: build load-to-kind apply rollout

status:
	$(DEPLOY) status

clean:
	$(DEPLOY) clean

trigger-traffic:
	$(DEPLOY) traffic

trigger-traffic-burst:
	kubectl delete deployment stacks-traffic -n stacks --ignore-not-found=true
	kubectl delete job stacks-traffic -n stacks --ignore-not-found=true
	sed 's/value: "1000"/value: "$(TRAFFIC_ITERATIONS)"/; s/value: "20"/value: "$(TRAFFIC_WORKERS)"/' k8s/traffic-job.yaml | kubectl apply -f -
	kubectl wait --for=condition=complete job/stacks-traffic -n stacks --timeout=1800s || \
		(kubectl logs job/stacks-traffic -n stacks --tail=50; exit 1)

stop-traffic:
	$(DEPLOY) stop-traffic

traffic-status:
	@kubectl get pods -n stacks -l app=stacks-traffic 2>/dev/null || echo "No traffic pods"
