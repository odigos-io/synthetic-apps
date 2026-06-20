#!/usr/bin/env sh

set -eu

# Port-forward head-sampling-http-server:8080 or set BASE_URL to the in-cluster Service URL.
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

call_endpoint "/http-match/control/no-rule"
call_repeated 20 "/http-match/exact/target"
call_repeated 20 "/http-match/prefix/segment"
call_repeated 20 "/http-match/prefix/segment/nested"
call_repeated 20 "/http-match/texact/res-42"
call_repeated 20 "/http-match/tprefix/tenant-a/items"
call_repeated 20 "/http-match/tprefix/tenant-b/items/item-7"
