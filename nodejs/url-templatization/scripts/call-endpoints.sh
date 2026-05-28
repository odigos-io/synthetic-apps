#!/usr/bin/env sh

set -eu

# Port-forward url-templatization:8080 or set BASE_URL to the in-cluster Service URL.
BASE_URL="${BASE_URL:-http://localhost:8080}"

call_endpoint() {
  path="$1"
  printf '\nGET %s%s\n' "$BASE_URL" "$path"
  curl -sS -w '\nHTTP %{http_code}\n' "$BASE_URL$path"
}

call_ok() {
  path="$1"
  curl -sS -f -o /dev/null "$BASE_URL$path"
}

call_many_ok() {
  count="$1"
  path="$2"
  i=1
  while [ "$i" -le "$count" ]; do
    call_ok "$path"
    i=$((i + 1))
  done
}

PREFIX_FRAMEWORK="/http-framework"
PREFIX_PLAIN="/plain-http"

call_endpoint "/healthz"

call_endpoint "$PREFIX_FRAMEWORK/default"
call_many_ok 10 "$PREFIX_FRAMEWORK/default/static/a"
call_many_ok 10 "$PREFIX_FRAMEWORK/default/static/a/b"
call_many_ok 10 "$PREFIX_FRAMEWORK/default/static/a/b/c"
call_many_ok 10 "$PREFIX_FRAMEWORK/default/templated/1/foo"
call_many_ok 10 "$PREFIX_FRAMEWORK/default/templated/2/foo/bar"
call_many_ok 10 "$PREFIX_FRAMEWORK/default/templated/3/foo/bar/baz"

call_endpoint "$PREFIX_FRAMEWORK/default/outbound/static"
call_endpoint "$PREFIX_FRAMEWORK/default/outbound/templated"
call_endpoint "$PREFIX_FRAMEWORK/default/outbound/all"
call_endpoint "$PREFIX_FRAMEWORK/default/outbound/static/1"
call_endpoint "$PREFIX_FRAMEWORK/default/outbound/static/2"
call_endpoint "$PREFIX_FRAMEWORK/default/outbound/static/3"
call_endpoint "$PREFIX_FRAMEWORK/default/outbound/templated/1"
call_endpoint "$PREFIX_FRAMEWORK/default/outbound/templated/2"
call_endpoint "$PREFIX_FRAMEWORK/default/outbound/templated/3"

call_endpoint "$PREFIX_PLAIN/default"
call_many_ok 10 "$PREFIX_PLAIN/default/static/a"
call_many_ok 10 "$PREFIX_PLAIN/default/static/a/b"
call_many_ok 10 "$PREFIX_PLAIN/default/static/a/b/c"
call_many_ok 10 "$PREFIX_PLAIN/default/templated/1/foo"
call_many_ok 10 "$PREFIX_PLAIN/default/templated/2/foo/bar"
call_many_ok 10 "$PREFIX_PLAIN/default/templated/3/foo/bar/baz"

call_endpoint "$PREFIX_PLAIN/default/outbound/static"
call_endpoint "$PREFIX_PLAIN/default/outbound/templated"
call_endpoint "$PREFIX_PLAIN/default/outbound/all"

call_endpoint "$PREFIX_FRAMEWORK/default/errors/404"
call_endpoint "$PREFIX_FRAMEWORK/default/errors/500"
call_endpoint "$PREFIX_PLAIN/default/errors/404"
call_endpoint "$PREFIX_PLAIN/default/errors/500"
