#!/bin/bash
#
# Test script for httppayload endpoints.
# Usage: ./test-payloads.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:8080

BASE_URL="${1:-http://localhost:8080}"

echo "============================================"
echo "Testing httppayload endpoints at $BASE_URL"
echo "============================================"

# ── 1. application/json ──
echo ""
echo "--- POST /payload/json (application/json) ---"
curl -s -X POST "$BASE_URL/payload/json" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","age":30,"tags":["developer","nodejs"]}' | jq .

# ── 2. text/plain ──
echo ""
echo "--- POST /payload/text (text/plain) ---"
curl -s -X POST "$BASE_URL/payload/text" \
  -H "Content-Type: text/plain" \
  -d 'Hello, this is a plain text payload for testing purposes.' | jq .

# ── 3. text/html ──
echo ""
echo "--- POST /payload/html (text/html) ---"
curl -s -X POST "$BASE_URL/payload/html" \
  -H "Content-Type: text/html" \
  -d '<html><body><h1>Hello World</h1><p>This is an HTML payload.</p></body></html>' | jq .

# ── 4. application/xml ──
echo ""
echo "--- POST /payload/xml (application/xml) ---"
curl -s -X POST "$BASE_URL/payload/xml" \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?><user><name>Bob</name><role>admin</role></user>' | jq .

# ── 5. application/x-www-form-urlencoded ──
echo ""
echo "--- POST /payload/form (application/x-www-form-urlencoded) ---"
curl -s -X POST "$BASE_URL/payload/form" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=charlie&password=secret123&remember=true' | jq .

# ── 6. multipart/form-data ──
echo ""
echo "--- POST /payload/multipart (multipart/form-data) ---"
curl -s -X POST "$BASE_URL/payload/multipart" \
  -F "username=dave" \
  -F "email=dave@example.com" \
  -F "file=@$(echo -n 'sample file content' > /tmp/httppayload-test.txt && echo /tmp/httppayload-test.txt)" | jq .

# ── 7. application/octet-stream ──
echo ""
echo "--- POST /payload/binary (application/octet-stream) ---"
curl -s -X POST "$BASE_URL/payload/binary" \
  -H "Content-Type: application/octet-stream" \
  --data-binary $'\xDE\xAD\xBE\xEF\x00\x01\x02\x03\x04\x05' | jq .

# ── 8. large JSON (~20KB) via POST ──
echo ""
echo "--- POST /payload/json-large (application/json, ~20KB) ---"
LARGE_JSON=$(node -e "
var items = [];
for (var i = 0; i < 120; i++) {
  items.push({
    id: i,
    uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function() {
      return Math.floor(Math.random() * 16).toString(16);
    }),
    name: 'User ' + i,
    email: 'user' + i + '@example.com',
    active: i % 3 !== 0,
    score: Math.round(Math.random() * 10000) / 100,
    tags: ['tag-' + (i % 5), 'tag-' + (i % 7), 'tag-' + (i % 11)]
  });
}
console.log(JSON.stringify({ metadata: { count: items.length }, items: items }));
")
curl -s -X POST "$BASE_URL/payload/json-large" \
  -H "Content-Type: application/json" \
  -d "$LARGE_JSON" | jq .

# ── 9. large JSON (~20KB) via GET (server generates payload) ──
echo ""
echo "--- GET /payload/json-large/generate (server-generated ~20KB JSON) ---"
curl -s "$BASE_URL/payload/json-large/generate" | jq .

echo ""
echo "============================================"
echo "All tests complete."
echo "============================================"
