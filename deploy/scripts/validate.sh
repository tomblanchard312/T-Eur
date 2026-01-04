#!/bin/bash
set -euo pipefail

# Validation script for tEUR deployment

echo "Validating deployment prerequisites..."

# Check tools
echo "Checking tools..."
command -v docker >/dev/null 2>&1 || { echo "docker not found"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "docker-compose not found"; exit 1; }

if [[ "${TEUR_ENV:-}" != "local" ]]; then
    command -v terraform >/dev/null 2>&1 || { echo "terraform not found"; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
fi

# Check environment variables
echo "Checking environment variables..."
[[ -n "${TEUR_ENV:-}" ]] || { echo "TEUR_ENV not set"; exit 1; }
[[ -n "${TEUR_ROLE:-}" ]] || { echo "TEUR_ROLE not set"; exit 1; }

# Check keys
echo "Checking keys..."
required_keys=("TEUR_ROOT_CA_KEY" "TEUR_ISSUER_KEY" "TEUR_ACQUIRER_KEY" "TEUR_PSP_KEY")
for key in "${required_keys[@]}"; do
    if [[ -z "${!key:-}" ]]; then
        key_file="$PROJECT_ROOT/keys/${key}.pem"
        [[ -f "$key_file" ]] || { echo "$key not found in env or file"; exit 1; }
    fi
done

echo "Validation passed."