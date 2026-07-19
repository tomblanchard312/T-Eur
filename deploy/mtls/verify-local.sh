#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
API_KEY="${TEUR_TEST_API_KEY:-demo-ecb-key}"
BASE_URL="${TEUR_MTLS_BASE_URL:-https://localhost:8443}"

required=(ca.crt client-ecb.crt client-ecb.key client-ncb.crt client-ncb.key)
for file in "${required[@]}"; do
  test -f "$DIR/pki/$file" || { echo "Missing $DIR/pki/$file; run generate-test-pki.sh first" >&2; exit 1; }
done

curl_common=(--silent --show-error --cacert "$DIR/pki/ca.crt")

status_without_cert=$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' "$BASE_URL/api/v1/health")
test "$status_without_cert" = "200"

status_valid=$(curl "${curl_common[@]}" --cert "$DIR/pki/client-ecb.crt" --key "$DIR/pki/client-ecb.key" \
  --header "X-API-Key: $API_KEY" --output /dev/null --write-out '%{http_code}' \
  "$BASE_URL/api/v1/admin/system/status")
test "$status_valid" = "200"

status_mismatch=$(curl "${curl_common[@]}" --cert "$DIR/pki/client-ncb.crt" --key "$DIR/pki/client-ncb.key" \
  --header "X-API-Key: $API_KEY" --output /dev/null --write-out '%{http_code}' \
  "$BASE_URL/api/v1/governance/keys")
test "$status_mismatch" = "403"

status_no_cert_privileged=$(curl "${curl_common[@]}" --header "X-API-Key: $API_KEY" \
  --output /dev/null --write-out '%{http_code}' "$BASE_URL/api/v1/governance/keys" || true)
test "$status_no_cert_privileged" = "000" || test "$status_no_cert_privileged" = "400"

printf 'mTLS local verification passed\n'
