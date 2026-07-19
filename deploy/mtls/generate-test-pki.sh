#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-$(cd "$(dirname "$0")" && pwd)/pki}"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

create_client() {
  local institution="$1"
  local name="$2"
  openssl genrsa -out "$OUT_DIR/${name}.key" 2048
  openssl req -new -key "$OUT_DIR/${name}.key" -out "$OUT_DIR/${name}.csr" \
    -subj "/CN=${institution}" \
    -addext "subjectAltName=URI:spiffe://teur.example/institution/${institution}" \
    -addext "extendedKeyUsage=clientAuth"
  cat > "$OUT_DIR/${name}.ext" <<EOF
subjectAltName=URI:spiffe://teur.example/institution/${institution}
extendedKeyUsage=clientAuth
keyUsage=digitalSignature
EOF
  openssl x509 -req -in "$OUT_DIR/${name}.csr" -CA "$OUT_DIR/ca.crt" -CAkey "$OUT_DIR/ca.key" \
    -CAcreateserial -out "$OUT_DIR/${name}.crt" -days 30 -sha256 -extfile "$OUT_DIR/${name}.ext"
}

openssl genrsa -out "$OUT_DIR/ca.key" 4096
openssl req -x509 -new -key "$OUT_DIR/ca.key" -sha256 -days 365 \
  -out "$OUT_DIR/ca.crt" -subj "/CN=tEUR Local Institutional Test CA"

openssl genrsa -out "$OUT_DIR/server.key" 2048
openssl req -new -key "$OUT_DIR/server.key" -out "$OUT_DIR/server.csr" \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
cat > "$OUT_DIR/server.ext" <<EOF
subjectAltName=DNS:localhost,IP:127.0.0.1
extendedKeyUsage=serverAuth
keyUsage=digitalSignature,keyEncipherment
EOF
openssl x509 -req -in "$OUT_DIR/server.csr" -CA "$OUT_DIR/ca.crt" -CAkey "$OUT_DIR/ca.key" \
  -CAcreateserial -out "$OUT_DIR/server.crt" -days 30 -sha256 -extfile "$OUT_DIR/server.ext"

create_client "ecb-core" "client-ecb"
create_client "ncb-de" "client-ncb"

chmod 600 "$OUT_DIR"/*.key
rm -f "$OUT_DIR"/*.csr "$OUT_DIR"/*.ext "$OUT_DIR"/*.srl

printf 'Generated local-only test certificates in %s\n' "$OUT_DIR"
printf 'Never use these generated keys outside local development or CI.\n'
