#!/usr/bin/env sh

set -eu

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

call_endpoint "/healthz/startup"
call_endpoint "/healthz/ready"
call_endpoint "/healthz/live"
call_endpoint "/healthz"
call_endpoint "/sampling/percentage/no-rule"
call_repeated 10 "/sampling/percentage/sampled-0"
call_repeated 30 "/sampling/percentage/sampled-50"
call_repeated 10 "/sampling/percentage/sampled-100"
call_repeated 10 "/sampling/percentage/sampled-fallback"
call_repeated 30 "/sampling/route/prefix"
call_repeated 30 "/sampling/route/prefix/part-one"
call_repeated 30 "/sampling/route/prefix/part-one/part-two"
