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

call_endpoint "/healthz"
call_endpoint "/sampling/tail/no-rule"
call_endpoint "/sampling/tail/no-rule?error=true"
call_endpoint "/sampling/tail/error"
call_endpoint "/sampling/tail/error?error=true"
call_repeated 30 "/sampling/tail/duration/short"
call_endpoint "/sampling/tail/duration/short?error=true"
call_repeated 6 "/sampling/tail/duration/medium"
call_endpoint "/sampling/tail/duration/medium?error=true"
call_endpoint "/sampling/tail/duration/long"
call_endpoint "/sampling/tail/duration/long?error=true"
call_endpoint "/sampling/tail/hops?hops=3"
call_endpoint "/sampling/tail/hops?hops=3&error=true"
call_endpoint "/sampling/tail/hops/non-propagating-error?hops=3"
call_endpoint "/sampling/tail/hops/non-propagating-error?hops=3&error=true"
