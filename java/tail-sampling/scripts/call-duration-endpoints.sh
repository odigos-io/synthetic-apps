#!/usr/bin/env sh

set -eu

# Port-forward tail-sampling-duration:8080 or set BASE_URL to the in-cluster Service URL.
BASE_URL="${BASE_URL:-http://localhost:8080}"

call_endpoint() {
  path="$1"
  printf '\nGET %s%s\n' "$BASE_URL" "$path"
  curl -sS -w '\nHTTP %{http_code}\n' "$BASE_URL$path"
}

call_repeated() {
  count="$1"
  path="$2"
  i=1
  while [ "$i" -le "$count" ]; do
    printf '\n[%s/%s]' "$i" "$count"
    call_endpoint "$path"
    i=$((i + 1))
  done
}

call_endpoint "/healthz"
call_endpoint "/duration?ms=0"
call_endpoint "/duration?ms=600"
call_endpoint "/duration?ms=1200"
call_repeated 30 "/duration/short"
call_repeated 6 "/duration/medium"
call_endpoint "/duration/long"
