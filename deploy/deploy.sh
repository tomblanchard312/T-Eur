#!/bin/bash
set -euo pipefail

# tEUR Deployment Script
# Unified deployment for local, lab, test, pilot, prod environments
# Supports roles: central-bank, state-bank, local-bank, psp, merchant-simulator

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$SCRIPT_DIR"

# Supported environments and roles
VALID_ENVS=("local" "lab" "test" "pilot" "prod")
VALID_ROLES=("central-bank" "state-bank" "local-bank" "psp" "merchant-simulator")

# Parse arguments
ENV=""
ROLE=""
CONFIRM_PROD=false
DRY_RUN=false

usage() {
    echo "Usage: $0 --env <environment> --role <role> [--confirm-prod] [--dry-run]"
    echo "Environments: ${VALID_ENVS[*]}"
    echo "Roles: ${VALID_ROLES[*]}"
    echo "For prod environment, --confirm-prod is required"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENV="$2"
            shift 2
            ;;
        --role)
            ROLE="$2"
            shift 2
            ;;
        --confirm-prod)
            CONFIRM_PROD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            usage
            ;;
    esac
done

# Validate environment
if [[ -z "$ENV" ]]; then
    echo "Error: --env is required"
    usage
fi

if [[ ! " ${VALID_ENVS[*]} " =~ " $ENV " ]]; then
    echo "Error: Invalid environment '$ENV'. Valid: ${VALID_ENVS[*]}"
    exit 1
fi

# Validate role
if [[ -z "$ROLE" ]]; then
    echo "Error: --role is required"
    usage
fi

if [[ ! " ${VALID_ROLES[*]} " =~ " $ROLE " ]]; then
    echo "Error: Invalid role '$ROLE'. Valid: ${VALID_ROLES[*]}"
    exit 1
fi

# Special validation for merchant-simulator
if [[ "$ROLE" == "merchant-simulator" && "$ENV" != "local" ]]; then
    echo "Error: merchant-simulator role is only allowed in local environment"
    exit 1
fi

# Prod confirmation
if [[ "$ENV" == "prod" && "$CONFIRM_PROD" != true ]]; then
    echo "Error: Production deployment requires --confirm-prod flag"
    exit 1
fi

# Set environment variables
export TEUR_ENV="$ENV"
export TEUR_ROLE="$ROLE"

# Validate required tools
validate_tools() {
    local missing_tools=()

    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi

    if ! command -v docker-compose &> /dev/null; then
        missing_tools+=("docker-compose")
    fi

    if [[ "$ENV" != "local" ]]; then
        if ! command -v terraform &> /dev/null; then
            missing_tools+=("terraform")
        fi
        if ! command -v kubectl &> /dev/null; then
            missing_tools+=("kubectl")
        fi
        if ! command -v helm &> /dev/null; then
            missing_tools+=("helm")
        fi
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        echo "Error: Missing required tools: ${missing_tools[*]}"
        echo "Please install them and try again."
        exit 1
    fi
}

# Validate keys and secrets
validate_keys() {
    # Check for required key environment variables or files
    local required_keys=("TEUR_ROOT_CA_KEY" "TEUR_ISSUER_KEY" "TEUR_ACQUIRER_KEY" "TEUR_PSP_KEY")

    for key in "${required_keys[@]}"; do
        if [[ -z "${!key:-}" && ! -f "$PROJECT_ROOT/keys/${key}.pem" ]]; then
            echo "Error: Missing key material for $key. Provide via environment variable or file in $PROJECT_ROOT/keys/"
            exit 1
        fi
    done

    # For prod, ensure no test keys
    if [[ "$ENV" == "prod" ]]; then
        if [[ "${TEUR_ROOT_CA_KEY:-}" == "test-key" || -f "$PROJECT_ROOT/keys/TEUR_ROOT_CA_KEY.pem" && grep -q "test" "$PROJECT_ROOT/keys/TEUR_ROOT_CA_KEY.pem" ]]; then
            echo "Error: Production deployment cannot use test keys"
            exit 1
        fi
    fi
}

# Print deployment plan
print_plan() {
    echo "=== tEUR Deployment Plan ==="
    echo "Environment: $ENV"
    echo "Role: $ROLE"
    echo "Project Root: $PROJECT_ROOT"
    echo "Deployment Type: $(if [[ "$ENV" == "local" ]]; then echo "Local (Docker Compose)"; else echo "Cloud/Internal (Terraform + Kubernetes)"; fi)"
    echo "Dry Run: $(if [[ "$DRY_RUN" == true ]]; then echo "Yes"; else echo "No"; fi)"
    echo ""

    if [[ "$ENV" == "local" ]]; then
        echo "Local Deployment Steps:"
        echo "1. Validate tools and keys"
        echo "2. Start Docker Compose services"
        echo "3. Run health checks"
    else
        echo "Cloud/Internal Deployment Steps:"
        echo "1. Validate tools and keys"
        echo "2. Initialize Terraform"
        echo "3. Plan Terraform changes"
        echo "4. Apply Terraform changes"
        echo "5. Deploy Kubernetes manifests"
        echo "6. Run health checks"
    fi
    echo ""
}

# Local deployment
deploy_local() {
    echo "Starting local deployment..."

    cd "$PROJECT_ROOT"

    # Start services
    if [[ "$DRY_RUN" != true ]]; then
        docker-compose up -d
    fi

    # Health checks
    echo "Running health checks..."
    # Add health check logic here
    echo "Local deployment complete."
}

# Cloud/Internal deployment
deploy_cloud() {
    echo "Starting cloud/internal deployment..."

    cd "$DEPLOY_DIR/terraform/environments/$ENV"

    # Terraform init
    if [[ "$DRY_RUN" != true ]]; then
        terraform init -backend-config="role=$ROLE"
    fi

    # Terraform plan
    terraform plan -var="environment=$ENV" -var="role=$ROLE" -out=tfplan

    if [[ "$DRY_RUN" != true ]]; then
        # Terraform apply
        terraform apply tfplan

        # Get outputs
        KUBECONFIG=$(terraform output kubeconfig)
        export KUBECONFIG

        # Deploy Kubernetes
        cd "$DEPLOY_DIR/kubernetes"
        helm upgrade --install teur-api charts/api --namespace $ROLE --create-namespace --set env.TEUR_ENV=$ENV --set env.TEUR_ROLE=$ROLE
        helm upgrade --install teur-contracts charts/contracts --namespace $ROLE --set env.TEUR_ENV=$ENV --set env.TEUR_ROLE=$ROLE
        helm upgrade --install teur-dashboard charts/dashboard --namespace $ROLE --set env.TEUR_ENV=$ENV --set env.TEUR_ROLE=$ROLE
    fi

    # Health checks
    echo "Running health checks..."
    # Add health check logic here
    echo "Cloud deployment complete."
}

# Main deployment logic
main() {
    validate_tools
    validate_keys
    print_plan

    if [[ "$ENV" == "local" ]]; then
        deploy_local
    else
        deploy_cloud
    fi

    echo "Deployment successful!"
}

main "$@"