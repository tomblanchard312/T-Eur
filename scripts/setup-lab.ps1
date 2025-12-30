# tEUR Lab Environment Setup Script for Windows
# Initializes a local Kubernetes cluster for development

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Configuration
$ClusterName = if ($env:CLUSTER_NAME) { $env:CLUSTER_NAME } else { "teur-lab" }
$K8sVersion = if ($env:K8S_VERSION) { $env:K8S_VERSION } else { "1.28.0" }

Write-Host "=== tEUR Lab Environment Setup ===" -ForegroundColor Cyan
Write-Host "Cluster Name: $ClusterName"
Write-Host "Kubernetes Version: $K8sVersion"
Write-Host ""

function Test-Prerequisites {
    Write-Host "Checking prerequisites..."
    
    $missing = @()
    
    if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) { $missing += "kubectl" }
    if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) { $missing += "terraform" }
    if (-not (Get-Command kind -ErrorAction SilentlyContinue)) { $missing += "kind" }
    
    if ($missing.Count -gt 0) {
        Write-Host "ERROR: Missing required tools: $($missing -join ', ')" -ForegroundColor Red
        Write-Host "Please install them before continuing."
        exit 1
    }
    
    Write-Host "All prerequisites satisfied." -ForegroundColor Green
}

function New-Cluster {
    Write-Host ""
    Write-Host "Creating Kubernetes cluster..."
    
    $existingClusters = kind get clusters 2>$null
    if ($existingClusters -contains $ClusterName) {
        Write-Host "Cluster '$ClusterName' already exists."
        $response = Read-Host "Delete and recreate? [y/N]"
        if ($response -eq 'y' -or $response -eq 'Y') {
            kind delete cluster --name $ClusterName
        }
        else {
            Write-Host "Using existing cluster."
            return
        }
    }
    
    $kindConfig = @"
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
"@
    
    $kindConfig | kind create cluster --name $ClusterName --config=-
    
    Write-Host "Cluster created successfully." -ForegroundColor Green
}

function Wait-ForCluster {
    Write-Host ""
    Write-Host "Waiting for cluster to be ready..."
    
    kubectl wait --for=condition=Ready nodes --all --timeout=300s
    kubectl wait --for=condition=Available deployment/coredns -n kube-system --timeout=300s
    
    Write-Host "Cluster is ready." -ForegroundColor Green
}

function Initialize-Terraform {
    Write-Host ""
    Write-Host "Initializing Terraform for ECB Core zone..."
    
    Push-Location "$ProjectRoot\envs\lab\ecb-core"
    try {
        terraform init
    }
    finally {
        Pop-Location
    }
    
    Write-Host "Terraform initialized." -ForegroundColor Green
}

function Deploy-Infrastructure {
    Write-Host ""
    $response = Read-Host "Apply ECB Core infrastructure? [y/N]"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Push-Location "$ProjectRoot\envs\lab\ecb-core"
        try {
            terraform plan -out=tfplan
            terraform apply tfplan
            Remove-Item tfplan -ErrorAction SilentlyContinue
            Write-Host "Infrastructure applied." -ForegroundColor Green
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Host "Skipping infrastructure deployment."
        Write-Host "Run 'terraform apply' in envs\lab\ecb-core when ready."
    }
}

# Main
Test-Prerequisites
New-Cluster
Wait-ForCluster
Initialize-Terraform
Deploy-Infrastructure

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. cd envs\lab\ecb-core; terraform apply"
Write-Host "  2. kubectl get pods -A"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  kubectl config use-context kind-$ClusterName"
Write-Host "  kind delete cluster --name $ClusterName"
