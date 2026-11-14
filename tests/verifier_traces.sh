#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
JAEGER_URL="${JAEGER_URL:-http://127.0.0.1:16686}"

ok=0
fail=0

pass() {
  echo "[OK] $1"
  ok=$((ok + 1))
}

ko() {
  echo "[ECHEC] $1"
  fail=$((fail + 1))
}

echo "=== Verification des traces OpenTelemetry (CineSlot) ==="

otlp_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/otlp/v1/traces" \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[]}')
if [[ "$otlp_code" == "200" ]]; then
  pass "Point 1 : Nginx relaie /otlp/v1/traces vers le collecteur (HTTP 200)"
else
  ko "Point 1 : /otlp/v1/traces a repondu HTTP ${otlp_code} au lieu de 200"
fi

curl -s "${BASE_URL}/api/slots" > /dev/null
sleep 6
api_services=$(curl -s "${JAEGER_URL}/api/v3/services")
if echo "$api_services" | grep -q '"cineslot-api"'; then
  pass "Point 2 : Jaeger recoit les traces de cineslot-api"
else
  ko "Point 2 : service cineslot-api non trouve dans Jaeger"
fi

trace_id=$(printf '%08x%08x%08x%08x' "$RANDOM$RANDOM" "$RANDOM$RANDOM" "$RANDOM$RANDOM" "$RANDOM$RANDOM")
span_id=$(printf '%08x%08x' "$RANDOM$RANDOM" "$RANDOM$RANDOM")
curl -s -H "traceparent: 00-${trace_id}-${span_id}-01" "${BASE_URL}/api/movies" > /dev/null
sleep 6
propagated=$(curl -s "${JAEGER_URL}/api/traces/${trace_id}")
if echo "$propagated" | grep -q "${trace_id}"; then
  pass "Point 3 : propagation traceparent W3C validee dans Jaeger (${trace_id})"
else
  ko "Point 3 : traceparent ${trace_id} non retrouve dans Jaeger"
fi

echo "Bilan : ${ok} OK, ${fail} ÉCHEC"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
