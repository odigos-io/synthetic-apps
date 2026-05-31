#!/bin/bash
#
# Assert spans in simple-trace-db match criteria and expected counts.
#
# Usage:
#   simple_trace_db_span_query_runner.sh <test.yaml> [--verbose] [namespace] [service]
#   simple_trace_db_span_query_runner.sh --dir <dir> [--verbose] [namespace] [service]
#
# Single span (kind: SpanTest):
#   match: { serviceName, kind, spanAttributes, resourceAttributes, ...EndsWith }
#   query: |   # optional raw JMESPath (overrides match)
#   expected: { count: N | minimum: N }
#
# Batch (kind: SpanBatchTest) — shared workload identity + list of span assertions:
#   serviceName: tail-sampling-errors
#   resourceAttributes: { k8s.deployment.name: tail-sampling-errors }
#   resourceAttributesEndsWith: { k8s.namespace.name: "-tail-sampling" }
#   spans:
#     - description: GET /error
#       kind: server
#       spanAttributes: { http.route: /error, http.status_code: 500 }
#       spanAttributesAbsent: { odigos.sampling.category: "" }  # key must not exist on span
#       spanAttributesContains: { http.target: "hops=3" }
#       spanStatusError: true
#       expected: { minimum: 1 }   # or count: N
#
set -euo pipefail

urlencode() (
  local length="${#1}"
  for ((i = 0; i < length; i++)); do
    local c="${1:i:1}"
    case $c in
    [a-zA-Z0-9.~_-]) printf "%c" "$c" ;;
    *) printf '%%%02X' "'$c" ;;
    esac
  done
)

jmes_escape_string() {
  printf "%s" "$1" | sed "s/'/\\\\'/g"
}

jmes_format_value() {
  local val=$1
  if [[ "$val" == "true" || "$val" == "false" ]]; then
    printf '`%s`' "$val"
  elif [[ "$val" =~ ^-?[0-9]+([.][0-9]+)?$ ]]; then
    printf '`%s`' "$val"
  else
    printf "'%s'" "$(jmes_escape_string "$val")"
  fi
}

jmes_map_key() {
  local prefix=$1
  local key=$2
  printf '%s."%s"' "$prefix" "$key"
}

append_condition() {
  local condition=$1
  if [[ -n "$SPAN_MATCH_QUERY" ]]; then
    SPAN_MATCH_QUERY+=" && ${condition}"
  else
    SPAN_MATCH_QUERY="${condition}"
  fi
}

# Join a yq path prefix with a field name. Avoids "..field" when prefix is ".".
yq_subpath() {
  local base=$1
  local field=$2
  if [[ "$base" == "." ]]; then
    printf '.%s' "$field"
  else
    printf '%s.%s' "$base" "$field"
  fi
}

yq_read() {
  local file=$1
  local base=$2
  local field=$3
  local expr=$4
  # explode(.) resolves YAML merge/alias anchors (e.g. spanAttributesAbsent: *anchor).
  yq e "explode(.) | $(yq_subpath "$base" "$field")${expr}" "$file"
}

append_resource_matchers_from_yq_path() {
  local file=$1
  local yq_path=$2
  local key value

  while IFS=$'\t' read -r key value; do
    [[ -z "$key" ]] && continue
    append_condition "$(jmes_map_key resourceAttributes "$key") == $(jmes_format_value "$value")"
  done < <(yq_read "$file" "$yq_path" "resourceAttributes" ' // {} | to_entries | .[] | [.key, (.value | tostring)] | @tsv')

  while IFS=$'\t' read -r key value; do
    [[ -z "$key" ]] && continue
    append_condition "ends_with($(jmes_map_key resourceAttributes "$key"), $(jmes_format_value "$value"))"
  done < <(yq_read "$file" "$yq_path" "resourceAttributesEndsWith" ' // {} | to_entries | .[] | [.key, (.value | tostring)] | @tsv')
}

append_span_field_matchers_from_yq_path() {
  local file=$1
  local yq_path=$2

  local service_name span_name kind span_status_error key value
  service_name=$(yq_read "$file" "$yq_path" "serviceName" ' // ""')
  if [[ -n "$service_name" && "$service_name" != "null" ]]; then
    append_condition "serviceName == $(jmes_format_value "$service_name")"
  fi

  span_name=$(yq_read "$file" "$yq_path" "name" ' // ""')
  if [[ -n "$span_name" && "$span_name" != "null" ]]; then
    append_condition "name == $(jmes_format_value "$span_name")"
  fi

  kind=$(yq_read "$file" "$yq_path" "kind" ' // ""')
  if [[ -n "$kind" && "$kind" != "null" ]]; then
    append_condition "kind == $(jmes_format_value "$kind")"
  fi

  span_status_error=$(yq_read "$file" "$yq_path" "spanStatusError" ' // ""')
  if [[ -n "$span_status_error" && "$span_status_error" != "null" ]]; then
    append_condition "spanStatusError == $(jmes_format_value "$span_status_error")"
  fi

  while IFS=$'\t' read -r key value; do
    [[ -z "$key" ]] && continue
    append_condition "$(jmes_map_key spanAttributes "$key") == $(jmes_format_value "$value")"
  done < <(yq_read "$file" "$yq_path" "spanAttributes" ' // {} | to_entries | .[] | [.key, (.value | tostring)] | @tsv')

  while IFS=$'\t' read -r key value; do
    [[ -z "$key" ]] && continue
    append_condition "ends_with($(jmes_map_key spanAttributes "$key"), $(jmes_format_value "$value"))"
  done < <(yq_read "$file" "$yq_path" "spanAttributesEndsWith" ' // {} | to_entries | .[] | [.key, (.value | tostring)] | @tsv')

  while IFS=$'\t' read -r key value; do
    [[ -z "$key" ]] && continue
    append_condition "contains($(jmes_map_key spanAttributes "$key"), $(jmes_format_value "$value"))"
  done < <(yq_read "$file" "$yq_path" "spanAttributesContains" ' // {} | to_entries | .[] | [.key, (.value | tostring)] | @tsv')

  while IFS=$'\t' read -r key _value; do
    [[ -z "$key" ]] && continue
    # Key must be missing from spanAttributes (not merely null/empty). Using keys()
    # avoids treating present booleans (e.g. trace.kept == false) as absent.
    append_condition "!contains(keys(spanAttributes), $(jmes_format_value "$key"))"
  done < <(yq_read "$file" "$yq_path" "spanAttributesAbsent" ' // {} | to_entries | .[] | [.key, (.value | tostring)] | @tsv')
}

append_matchers_from_yq_path() {
  local file=$1
  local yq_path=$2
  append_span_field_matchers_from_yq_path "$file" "$yq_path"
  append_resource_matchers_from_yq_path "$file" "$yq_path"
}

build_query_from_match() {
  local file=$1
  SPAN_MATCH_QUERY=""
  append_matchers_from_yq_path "$file" ".match"
  if [[ -z "$SPAN_MATCH_QUERY" ]]; then
    echo "SpanTest must define query or at least one match field: $file" >&2
    exit 1
  fi
  printf "%s" "$SPAN_MATCH_QUERY"
}

build_query_for_batch_span() {
  local file=$1
  local span_index=$2
  local span_path=".spans[${span_index}]"

  SPAN_MATCH_QUERY=""

  local service_name
  service_name=$(yq e '.serviceName // ""' "$file")
  if [[ -z "$service_name" || "$service_name" == "null" ]]; then
    echo "SpanBatchTest requires serviceName: $file" >&2
    exit 1
  fi
  append_condition "serviceName == $(jmes_format_value "$service_name")"

  append_resource_matchers_from_yq_path "$file" "."
  append_span_field_matchers_from_yq_path "$file" "$span_path"

  if [[ -z "$SPAN_MATCH_QUERY" ]]; then
    echo "SpanBatchTest span[${span_index}] must define span fields or query: $file" >&2
    exit 1
  fi
  printf "%s" "$SPAN_MATCH_QUERY"
}

resolve_query() {
  local file=$1
  local explicit_query
  explicit_query=$(yq e '.query // ""' "$file")
  if [[ -n "$explicit_query" && "$explicit_query" != "null" ]]; then
    yq e '.query' "$file"
    return
  fi
  build_query_from_match "$file"
}

span_has_match_fields() {
  local file=$1
  local span_path=$2
  local count
  count=$(yq e "explode(.) | ${span_path} | (
    (.kind // \"\") != \"\" or
    (.name // \"\") != \"\" or
    (.spanStatusError != null) or
    ((.spanAttributes // {}) | length) > 0 or
    ((.spanAttributesEndsWith // {}) | length) > 0 or
    ((.spanAttributesContains // {}) | length) > 0 or
    ((.spanAttributesAbsent // {}) | length) > 0
  )" "$file")
  [[ "$count" == "true" ]]
}

verify_span_expected() {
  local file=$1
  local yq_path=$2

  local expected_count minimum_count
  expected_count=$(yq_read "$file" "$yq_path" "expected" '.count // ""')
  minimum_count=$(yq_read "$file" "$yq_path" "expected" '.minimum // ""')

  if [[ ("$expected_count" == "null" || -z "$expected_count") && ("$minimum_count" == "null" || -z "$minimum_count") ]]; then
    echo "Invalid schema in $file at ${yq_path}: expected.count or expected.minimum is required" >&2
    exit 1
  fi
}

verify_yaml_schema() {
  local file=$1
  local kind
  kind=$(yq e '.kind // "SpanTest"' "$file")

  case "$kind" in
  SpanTest)
    verify_span_expected "$file" "."
    local query has_match
    query=$(yq e '.query // ""' "$file")
    has_match=$(yq e '.match // {} | length' "$file")
    if [[ ("$query" == "null" || -z "$query") && "$has_match" == "0" ]]; then
      echo "Invalid SpanTest schema in $file: query or match is required" >&2
      exit 1
    fi
    ;;
  SpanBatchTest)
    local service_name span_count
    service_name=$(yq e '.serviceName // ""' "$file")
    if [[ -z "$service_name" || "$service_name" == "null" ]]; then
      echo "Invalid SpanBatchTest schema in $file: serviceName is required" >&2
      exit 1
    fi
    span_count=$(yq e '.spans | length' "$file")
    if [[ "$span_count" == "0" ]]; then
      echo "Invalid SpanBatchTest schema in $file: spans must be a non-empty list" >&2
      exit 1
    fi
    local i
    for ((i = 0; i < span_count; i++)); do
      verify_span_expected "$file" ".spans[${i}]"
      if ! span_has_match_fields "$file" ".spans[${i}]"; then
        echo "Invalid SpanBatchTest schema in $file: spans[${i}] must set kind, name, spanStatusError, or spanAttributes* matchers" >&2
        exit 1
      fi
    done
    ;;
  *)
    echo "Unsupported kind '$kind' in $file (expected SpanTest or SpanBatchTest)" >&2
    exit 1
    ;;
  esac
}

assert_expected_count_at_path() {
  local file=$1
  local yq_path=$2
  local actual=$3
  local label=$4

  local expected_count minimum_count description span_id
  expected_count=$(yq_read "$file" "$yq_path" "expected" '.count // ""')
  minimum_count=$(yq_read "$file" "$yq_path" "expected" '.minimum // ""')
  description=$(yq_read "$file" "$yq_path" "description" ' // ""')
  span_id=$(yq_read "$file" "$yq_path" "id" ' // ""')

  if [[ -n "$label" ]]; then
    echo "Assertion [$label]"
  elif [[ -n "$span_id" && "$span_id" != "null" ]]; then
    echo "Assertion [$span_id]"
  fi
  if [[ -n "$description" && "$description" != "null" ]]; then
    echo "  $description"
  fi

  if [[ -n "$expected_count" && "$expected_count" != "null" ]]; then
    if [[ "$actual" -ne "$expected_count" ]]; then
      echo "FAILED: expected exactly $expected_count unique span(s), got $actual" >&2
      exit 1
    fi
    echo "PASSED: expected exactly $expected_count unique span(s), got $actual"
    return
  fi

  if [[ -n "$minimum_count" && "$minimum_count" != "null" ]]; then
    if [[ "$actual" -lt "$minimum_count" ]]; then
      echo "FAILED: expected at least $minimum_count unique span(s), got $actual" >&2
      exit 1
    fi
    echo "PASSED: expected at least $minimum_count unique span(s), got $actual"
    return
  fi

  echo "Invalid expected block at ${yq_path} in $file" >&2
  exit 1
}

query_spans() {
  local query=$1
  local dest_namespace=$2
  local dest_service=$3
  local dest_port=$4
  local encoded_query response

  encoded_query=$(urlencode "$query")
  response=$(kubectl get --raw "/api/v1/namespaces/${dest_namespace}/services/${dest_service}:${dest_port}/proxy/v1/spans?jmespath=${encoded_query}")
  printf "%s" "$response"
}

# simple-trace-db appends every exported span; Odigos may POST the same span more than once
# (e.g. sampling dry-run). Count unique spanIds so assertions match logical requests.
count_unique_matching_spans() {
  local response=$1
  local raw_count unique_count
  raw_count=$(echo "$response" | jq 'length')
  unique_count=$(echo "$response" | jq '[.[].spanId] | unique | length')
  if [[ "$raw_count" != "$unique_count" ]]; then
    echo "Note: ${raw_count} matching span record(s) in simple-trace-db, ${unique_count} unique spanId(s)" >&2
  fi
  printf "%s" "$unique_count"
}

process_span_assertion() {
  local file=$1
  local verbose=$2
  local dest_namespace=$3
  local dest_service=$4
  local query=$5
  local yq_path=$6
  local label=$7

  local response span_count
  echo "JMESPath filter: $query"

  response=$(query_spans "$query" "$dest_namespace" "$dest_service" "4318")

  if [[ "$verbose" == "true" ]]; then
    echo "============== Matching spans ===================="
    echo "$response" | jq .
    echo "=================================================="
  fi

  span_count=$(count_unique_matching_spans "$response")
  assert_expected_count_at_path "$file" "$yq_path" "$span_count" "$label"
}

process_span_batch_file() {
  local file=$1
  local verbose=$2
  local dest_namespace=$3
  local dest_service=$4

  verify_yaml_schema "$file"

  local file_name span_count batch_description i
  file_name=$(basename "$file")
  span_count=$(yq e '.spans | length' "$file")
  batch_description=$(yq e '.description // ""' "$file")

  echo "Running span batch $file_name ($span_count span assertion(s))"
  echo "Dest namespace: $dest_namespace"
  echo "Dest service: $dest_service"
  if [[ -n "$batch_description" && "$batch_description" != "null" ]]; then
    echo "Batch: $batch_description"
  fi
  echo "Workload: serviceName=$(yq e '.serviceName' "$file")"

  for ((i = 0; i < span_count; i++)); do
    local span_path=".spans[${i}]" query label
    label=$(yq_read "$file" "$span_path" "id" " // \"span-${i}\"")
    query=$(build_query_for_batch_span "$file" "$i")
    process_span_assertion "$file" "$verbose" "$dest_namespace" "$dest_service" "$query" "$span_path" "$label"
    echo ""
  done
}

process_span_test_file() {
  local file=$1
  local verbose=$2
  local dest_namespace=$3
  local dest_service=$4

  verify_yaml_schema "$file"

  local file_name query
  file_name=$(basename "$file")
  query=$(resolve_query "$file")

  echo "Running span test $file_name"
  echo "Dest namespace: $dest_namespace"
  echo "Dest service: $dest_service"

  process_span_assertion "$file" "$verbose" "$dest_namespace" "$dest_service" "$query" "." ""
}

process_yaml_file() {
  local file=$1
  local verbose=$2
  local dest_namespace=${3:-traces}
  local dest_service=${4:-simple-trace-db}
  local kind

  kind=$(yq e '.kind // "SpanTest"' "$file")
  case "$kind" in
  SpanBatchTest)
    process_span_batch_file "$file" "$verbose" "$dest_namespace" "$dest_service"
    ;;
  SpanTest)
    process_span_test_file "$file" "$verbose" "$dest_namespace" "$dest_service"
    ;;
  *)
    echo "Unsupported kind '$kind' in $file" >&2
    exit 1
    ;;
  esac
}

run_all_in_dir() {
  local dir=$1
  local verbose=$2
  local dest_namespace=$3
  local dest_service=$4
  local file

  shopt -s nullglob
  local files=("$dir"/*.yaml "$dir"/*.yml)
  shopt -u nullglob

  if ((${#files[@]} == 0)); then
    echo "No span test YAML files found in $dir" >&2
    exit 1
  fi

  for file in "${files[@]}"; do
    process_yaml_file "$file" "$verbose" "$dest_namespace" "$dest_service"
  done
}

if ! command -v yq &>/dev/null; then
  echo "yq command not found. Please install yq." >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "jq command not found. Please install jq." >&2
  exit 1
fi

VERBOSE=false
DESTINATION_NAMESPACE="${TRACE_NAMESPACE:-traces}"
DESTINATION_SERVICE="simple-trace-db"

if [[ $# -lt 1 ]]; then
  cat >&2 <<'EOF'
Usage:
  simple_trace_db_span_query_runner.sh <test.yaml> [--verbose] [namespace] [service]
  simple_trace_db_span_query_runner.sh --dir <directory> [--verbose] [namespace] [service]
EOF
  exit 1
fi

if [[ "$1" == "--dir" ]]; then
  if [[ $# -lt 2 ]]; then
    echo "--dir requires a directory path" >&2
    exit 1
  fi
  QUERY_DIR=$2
  shift 2
else
  TEST_FILES=("$1")
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
  --verbose)
    VERBOSE=true
    shift
    ;;
  "")
    shift
    ;;
  *)
    break
    ;;
  esac
done

if [[ -n "${1:-}" ]]; then
  DESTINATION_NAMESPACE=$1
  shift
fi
if [[ -n "${1:-}" ]]; then
  DESTINATION_SERVICE=$1
  shift
fi

if [[ -n "${QUERY_DIR:-}" ]]; then
  run_all_in_dir "$QUERY_DIR" "$VERBOSE" "$DESTINATION_NAMESPACE" "$DESTINATION_SERVICE"
  exit 0
fi

for test_file in "${TEST_FILES[@]}"; do
  process_yaml_file "$test_file" "$VERBOSE" "$DESTINATION_NAMESPACE" "$DESTINATION_SERVICE"
done
