# tEUR Kind Deployment Scripts

This directory contains scripts to build and deploy the complete tEUR (Tokenized Euro) system to a local Kind cluster.

## Scripts

- `deploy-kind.ps1` - PowerShell script for Windows
- `deploy-kind.sh` - Bash script for Linux/macOS

## Prerequisites

Before running the scripts, ensure you have the following tools installed:

- [Docker](https://docs.docker.com/get-docker/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- PowerShell 7+ (for Windows script) or Bash (for Linux/macOS script)

## Usage

### PowerShell (Windows)

```powershell
# Full deployment (build images, create cluster, deploy services)
.\deploy-kind.ps1

# Skip building images (use existing ones)
.\deploy-kind.ps1 -SkipBuild

# Skip cluster creation (use existing cluster)
.\deploy-kind.ps1 -SkipCluster

# Clean up existing cluster
.\deploy-kind.ps1 -Clean

# Custom cluster name and Kubernetes version
.\deploy-kind.ps1 -ClusterName "my-teur-cluster" -KubernetesVersion "1.29.0"
```

### Bash (Linux/macOS)

```bash
# Make script executable (first time only)
chmod +x deploy-kind.sh

# Full deployment (build images, create cluster, deploy services)
./deploy-kind.sh

# Skip building images (use existing ones)
./deploy-kind.sh --skip-build

# Skip cluster creation (use existing cluster)
./deploy-kind.sh --skip-cluster

# Clean up existing cluster
./deploy-kind.sh --clean

# Custom cluster name and Kubernetes version
CLUSTER_NAME=my-teur-cluster KUBERNETES_VERSION=1.29.0 ./deploy-kind.sh
```

## What the Scripts Do

1. **Prerequisites Check**: Verifies all required tools are installed and Docker is running
2. **Cluster Creation**: Creates a Kind cluster with necessary port mappings
3. **Image Building**: Builds Docker images for all tEUR services:
   - API Gateway (`api/`)
   - Admin Dashboard (`dashboard/`)
   - ISO 20022 Adapter (`iso20022-adapter/`)
4. **Image Loading**: Loads built images into the Kind cluster
5. **Kubernetes Resources**: Applies base Kubernetes resources and creates namespaces
6. **Service Deployment**: Deploys all services including:
   - PostgreSQL database
   - Prometheus monitoring
   - Hyperledger Besu blockchain node
   - tEUR API Gateway
   - Admin Dashboard
   - ISO 20022 Adapter
7. **Health Checks**: Waits for all services to be ready
8. **Status Display**: Shows cluster information and access URLs

## Access URLs

After successful deployment, the services will be available at:

- **API Gateway**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3001
- **ISO 20022 Adapter**: http://localhost:4000
- **Prometheus**: http://localhost:9090
- **Besu RPC**: http://localhost:8545
- **PostgreSQL**: localhost:5432 (from host)

## Environment Variables

The scripts support the following environment variables:

- `CLUSTER_NAME` - Name of the Kind cluster (default: `teur-lab`)
- `KUBERNETES_VERSION` - Kubernetes version to use (default: `1.28.0`)

## Troubleshooting

### Cluster Creation Issues

- Ensure Docker has enough resources allocated
- Check that ports 80, 443, 3000-4000, 5432, 8545, 9090 are not in use

### Image Build Failures

- Ensure Docker is running
- Check that all required files exist in the service directories
- Verify network connectivity for pulling base images

### Service Deployment Issues

- Check cluster status: `kubectl get nodes`
- View pod status: `kubectl get pods --all-namespaces`
- Check pod logs: `kubectl logs -n <namespace> <pod-name>`

### Cleanup

To completely clean up the deployment:

```bash
# PowerShell
.\deploy-kind.ps1 -Clean

# Bash
./deploy-kind.sh --clean
```

Or manually:

```bash
kind delete cluster --name teur-lab
```

## Architecture

The deployment creates a multi-namespace Kubernetes cluster:

- `obs-global` - Observability services (Prometheus)
- `teur-csp` - Core settlement plane (API, Besu, PostgreSQL, ISO20022)
- `teur-pap` - Public access plane (Dashboard)

All services are configured with appropriate networking and security policies as defined in the `k8s/base/` resources.
