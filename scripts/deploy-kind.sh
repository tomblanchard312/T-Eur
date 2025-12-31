#!/bin/bash
# tEUR Kind Deployment Script (Bash)
# Builds and deploys all tEUR components to a local Kind cluster

set -euo pipefail

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-teur-lab}"
KUBERNETES_VERSION="${KUBERNETES_VERSION:-1.28.0}"
REGISTRY="teur-local"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Services configuration
declare -a IMAGES=(
    "api:api:Dockerfile"
    "dashboard:dashboard:Dockerfile"
    "iso20022-adapter:iso20022-adapter:Dockerfile"
)

declare -a NAMESPACES=(
    "obs-global"
    "teur-csp"
    "teur-pap"
)

# Parse command line arguments
SKIP_BUILD=false
SKIP_CLUSTER=false
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-cluster)
            SKIP_CLUSTER=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-build    Skip building Docker images"
            echo "  --skip-cluster  Skip creating Kind cluster"
            echo "  --clean         Clean up existing cluster and exit"
            echo "  -h, --help      Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  CLUSTER_NAME          Kind cluster name (default: teur-lab)"
            echo "  KUBERNETES_VERSION    Kubernetes version (default: 1.28.0)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information."
            exit 1
            ;;
    esac
done

log_step() {
    echo -e "${CYAN}=== $1 ===${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_prerequisites() {
    log_step "Checking Prerequisites"

    local missing=()
    local commands=("kubectl" "kind" "docker")

    for cmd in "${commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_error "Please install them before continuing."
        exit 1
    fi

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker."
        exit 1
    fi

    log_success "All prerequisites satisfied."
}

cleanup_cluster() {
    log_step "Cleaning Up Existing Cluster"

    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_info "Deleting existing cluster '$CLUSTER_NAME'..."
        kind delete cluster --name "$CLUSTER_NAME"
    fi
}

create_kind_cluster() {
    log_step "Creating Kind Cluster"

    local kind_config_file
    kind_config_file=$(mktemp)

    cat > "$kind_config_file" << EOF
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
  - containerPort: 3000
    hostPort: 3000
    protocol: TCP
  - containerPort: 3001
    hostPort: 3001
    protocol: TCP
  - containerPort: 4000
    hostPort: 4000
    protocol: TCP
  - containerPort: 8545
    hostPort: 8545
    protocol: TCP
  - containerPort: 9090
    hostPort: 9090
    protocol: TCP
  - containerPort: 5432
    hostPort: 5432
    protocol: TCP
EOF

    log_info "Creating cluster '$CLUSTER_NAME' with Kubernetes v$KUBERNETES_VERSION..."
    kind create cluster --name "$CLUSTER_NAME" --config "$kind_config_file" --image "kindest/node:v$KUBERNETES_VERSION"

    # Wait for cluster to be ready
    log_info "Waiting for cluster to be ready..."
    kubectl wait --for=condition=Ready nodes --all --timeout=300s

    rm -f "$kind_config_file"
    log_success "Cluster created successfully."
}

build_docker_images() {
    log_step "Building Docker Images"

    cd "$PROJECT_ROOT"

    for image_spec in "${IMAGES[@]}"; do
        IFS=':' read -r name context dockerfile <<< "$image_spec"
        local image_name="$REGISTRY/$name:latest"

        log_info "Building image: $image_name"
        if ! docker build -t "$image_name" -f "$context/$dockerfile" "$context"; then
            log_error "Failed to build image: $image_name"
            exit 1
        fi
        log_success "Built: $image_name"
    done

    cd - >/dev/null
}

load_images_to_kind() {
    log_step "Loading Images into Kind"

    for image_spec in "${IMAGES[@]}"; do
        IFS=':' read -r name _ <<< "$image_spec"
        local image_name="$REGISTRY/$name:latest"

        log_info "Loading image into Kind: $image_name"
        kind load docker-image "$image_name" --name "$CLUSTER_NAME"
    done

    log_success "All images loaded into Kind."
}

install_kubernetes_resources() {
    log_step "Installing Kubernetes Resources"

    cd "$PROJECT_ROOT"

    # Apply base resources
    log_info "Applying base Kubernetes resources..."
    kubectl apply -k k8s/base/

    # Create namespaces
    for ns in "${NAMESPACES[@]}"; do
        log_info "Creating namespace: $ns"
        kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
    done

    cd - >/dev/null
    log_success "Kubernetes resources installed."
}

deploy_services() {
    log_step "Deploying tEUR Services"

    # Define services
    declare -a services=(
        "postgres:postgres:16-alpine:5432:teur-csp"
        "prometheus:prom/prometheus:v2.48.1:9090:obs-global"
        "besu-ecb-core:hyperledger/besu:24.1.0:8545:teur-csp"
        "api:$REGISTRY/api:latest:3000:teur-csp"
        "dashboard:$REGISTRY/dashboard:latest:80:teur-pap"
        "iso20022-adapter:$REGISTRY/iso20022-adapter:latest:4000:teur-csp"
    )

    for service_spec in "${services[@]}"; do
        IFS=':' read -r name image port namespace <<< "$service_spec"

        log_info "Deploying service: $name"

        # Create deployment YAML
        local deployment_file
        deployment_file=$(mktemp)

        cat > "$deployment_file" << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $name
  namespace: $namespace
spec:
  replicas: 1
  selector:
    matchLabels:
      app: $name
  template:
    metadata:
      labels:
        app: $name
    spec:
      containers:
      - name: $name
        image: $image
        ports:
        - containerPort: $port
---
apiVersion: v1
kind: Service
metadata:
  name: $name
  namespace: $namespace
spec:
  selector:
    app: $name
  ports:
  - port: $port
    targetPort: $port
  type: ClusterIP
EOF

        kubectl apply -f "$deployment_file"
        rm -f "$deployment_file"
    done

    log_success "All services deployed."
}

wait_for_services() {
    log_step "Waiting for Services to be Ready"

    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment --all --all-namespaces

    log_success "Services are ready."
}

show_status() {
    log_step "Deployment Status"

    echo -e "${YELLOW}Cluster info:${NC}"
    kubectl cluster-info

    echo -e "\n${YELLOW}Namespaces:${NC}"
    kubectl get namespaces

    echo -e "\n${YELLOW}Pods:${NC}"
    kubectl get pods --all-namespaces

    echo -e "\n${YELLOW}Services:${NC}"
    kubectl get services --all-namespaces

    echo -e "\n${YELLOW}Access URLs:${NC}"
    echo "API: http://localhost:3000"
    echo "Dashboard: http://localhost:3001"
    echo "ISO20022 Adapter: http://localhost:4000"
    echo "Prometheus: http://localhost:9090"
    echo "Besu RPC: http://localhost:8545"
    echo "PostgreSQL: localhost:5432"
}

main() {
    echo -e "${MAGENTA}tEUR Kind Deployment Script${NC}"
    echo -e "${MAGENTA}==========================${NC}"

    check_prerequisites

    if [ "$CLEAN" = true ]; then
        cleanup_cluster
        exit 0
    fi

    if [ "$SKIP_CLUSTER" = false ]; then
        cleanup_cluster
        create_kind_cluster
    fi

    if [ "$SKIP_BUILD" = false ]; then
        build_docker_images
    fi

    load_images_to_kind
    install_kubernetes_resources
    deploy_services
    wait_for_services
    show_status

    echo -e "\n${GREEN}🎉 tEUR deployment completed successfully!${NC}"
    echo -e "${CYAN}Use 'kubectl get pods --all-namespaces' to check status.${NC}"
}

# Run main function
main "$@"