#!/bin/bash
# tEUR Local Lab Setup Script
# Initializes a local Kubernetes cluster for development

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-teur-lab}"
K8S_VERSION="${K8S_VERSION:-1.28.0}"

echo "=== tEUR Lab Environment Setup ==="
echo "Cluster Name: $CLUSTER_NAME"
echo "Kubernetes Version: $K8S_VERSION"
echo ""

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    local missing=()
    
    command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
    command -v terraform >/dev/null 2>&1 || missing+=("terraform")
    command -v kind >/dev/null 2>&1 || missing+=("kind")
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo "ERROR: Missing required tools: ${missing[*]}"
        echo "Please install them before continuing."
        exit 1
    fi
    
    echo "All prerequisites satisfied."
}

# Create kind cluster
create_cluster() {
    echo ""
    echo "Creating Kubernetes cluster..."
    
    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        echo "Cluster '$CLUSTER_NAME' already exists."
        read -p "Delete and recreate? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kind delete cluster --name "$CLUSTER_NAME"
        else
            echo "Using existing cluster."
            return 0
        fi
    fi
    
    cat <<EOF | kind create cluster --name "$CLUSTER_NAME" --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
      - containerPort: 30303
        hostPort: 30303
        protocol: TCP
  - role: worker
  - role: worker
  - role: worker
EOF
    
    echo "Cluster created successfully."
}

# Wait for cluster to be ready
wait_for_cluster() {
    echo ""
    echo "Waiting for cluster to be ready..."
    
    kubectl wait --for=condition=Ready nodes --all --timeout=300s
    kubectl wait --for=condition=Available deployment/coredns -n kube-system --timeout=300s
    
    echo "Cluster is ready."
}

# Initialize Terraform for ECB Core
init_terraform() {
    echo ""
    echo "Initializing Terraform for ECB Core zone..."
    
    cd "$PROJECT_ROOT/envs/lab/ecb-core"
    
    terraform init
    
    echo "Terraform initialized."
}

# Apply infrastructure
apply_infrastructure() {
    echo ""
    read -p "Apply ECB Core infrastructure? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$PROJECT_ROOT/envs/lab/ecb-core"
        terraform plan -out=tfplan
        terraform apply tfplan
        rm tfplan
        echo "Infrastructure applied."
    else
        echo "Skipping infrastructure deployment."
        echo "Run 'terraform apply' in envs/lab/ecb-core when ready."
    fi
}

# Main
main() {
    check_prerequisites
    create_cluster
    wait_for_cluster
    init_terraform
    apply_infrastructure
    
    echo ""
    echo "=== Setup Complete ==="
    echo ""
    echo "Next steps:"
    echo "  1. cd envs/lab/ecb-core && terraform apply"
    echo "  2. kubectl get pods -A"
    echo ""
    echo "Useful commands:"
    echo "  kubectl config use-context kind-$CLUSTER_NAME"
    echo "  kind delete cluster --name $CLUSTER_NAME"
}

main "$@"
