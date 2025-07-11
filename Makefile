
.PHONY: test-runtime-version
test-runtime-version:
	kind delete cluster --name test-versions
	kind create cluster --name test-versions --config tests/kind-config.yaml
	chainsaw test tests/runtime-version
