# tEUR Kind Deployment Script (PowerShell)
# Builds and deploys all tEUR components to a local Kind cluster

param(
    [string]$ClusterName = "teur-lab",
    [string]$KubernetesVersion = "1.28.0",
    [switch]$SkipBuild,
    [switch]$SkipCluster,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Configuration
$Config = @{
    ClusterName       = $ClusterName
    KubernetesVersion = $KubernetesVersion
    Registry          = "teur-local"
    Images            = @(
        @{ Name = "api"; Context = "api"; Dockerfile = "Dockerfile" }
        @{ Name = "dashboard"; Context = "dashboard"; Dockerfile = "Dockerfile" }
        @{ Name = "iso20022-adapter"; Context = "iso20022-adapter"; Dockerfile = "Dockerfile" }
    )
    Namespaces        = @("obs-global", "teur-csp", "teur-pap")
}

function Write-Step {
    param([string]$Message)
    Write-Host "=== $Message ===" -ForegroundColor Cyan
}

function Test-Prerequisites {
    Write-Step "Checking Prerequisites"

    $requiredCommands = @("kubectl", "kind", "docker")
    $missing = @()

    foreach ($cmd in $requiredCommands) {
        if (!(Get-Command $cmd -ErrorAction SilentlyContinue)) {
            $missing += $cmd
        }
    }

    if ($missing.Count -gt 0) {
        Write-Error "Missing required tools: $($missing -join ', ')"
        exit 1
    }

    # Check if Docker is running
    try {
        $null = docker info 2>$null
    }
    catch {
        Write-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }

    Write-Host "All prerequisites satisfied." -ForegroundColor Green
}

function Remove-ExistingCluster {
    Write-Step "Removing Existing Cluster"

    if (kind get clusters 2>$null | Select-String "^$($Config.ClusterName)$") {
        Write-Host "Deleting existing cluster '$($Config.ClusterName)'..."
        kind delete cluster --name $Config.ClusterName
    }
}

function New-KindCluster {
    Write-Step "Creating Kind Cluster"

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
"@

    $kindConfig | Out-File -FilePath "$env:TEMP\kind-config.yaml" -Encoding UTF8

    Write-Host "Creating cluster '$($Config.ClusterName)' with Kubernetes v$($Config.KubernetesVersion)..."
    kind create cluster --name $Config.ClusterName --config "$env:TEMP\kind-config.yaml" --image "kindest/node:v$($Config.KubernetesVersion)"

    # Wait for cluster to be ready
    Write-Host "Waiting for cluster to be ready..."
    kubectl wait --for=condition=Ready nodes --all --timeout=300s

    Write-Host "Cluster created successfully." -ForegroundColor Green
}

function Build-DockerImages {
    Write-Step "Building Docker Images"

    Push-Location $ProjectRoot

    try {
        foreach ($image in $Config.Images) {
            $imageName = "$($Config.Registry)/$($image.Name):latest"
            Write-Host "Building image: $imageName"

            $buildArgs = @(
                "build",
                "-t", $imageName,
                "-f", "$($image.Context)/$($image.Dockerfile)",
                $image.Context
            )

            & docker $buildArgs

            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to build image: $imageName"
                exit 1
            }

            Write-Host "Successfully built: $imageName" -ForegroundColor Green
        }
    }
    finally {
        Pop-Location
    }
}

function Import-ImagesToKind {
    Write-Step "Loading Images into Kind"

    foreach ($image in $Config.Images) {
        $imageName = "$($Config.Registry)/$($image.Name):latest"
        Write-Host "Loading image into Kind: $imageName"
        kind load docker-image $imageName --name $Config.ClusterName
    }

    Write-Host "All images loaded into Kind." -ForegroundColor Green
}

function Install-KubernetesResources {
    Write-Step "Installing Kubernetes Resources"

    Push-Location $ProjectRoot

    try {
        # Apply base resources
        Write-Host "Applying base Kubernetes resources..."
        kubectl apply -k k8s/base/

        # Create namespaces
        foreach ($ns in $Config.Namespaces) {
            Write-Host "Creating namespace: $ns"
            kubectl create namespace $ns --dry-run=client -o yaml | kubectl apply -f -
        }

        # Apply infrastructure (using docker-compose as reference)
        Write-Host "Setting up infrastructure services..."

        # Create ConfigMaps and Secrets
        Write-Host "Creating ConfigMaps and Secrets..."
        # Note: In production, use proper secret management

        Write-Host "Kubernetes resources installed." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Deploy-Services {
    Write-Step "Deploying tEUR Services"

    # Create deployments and services based on docker-compose.yml
    $services = @(
        @{
            Name      = "postgres"
            Image     = "postgres:16-alpine"
            Port      = 5432
            Namespace = "teur-csp"
            Env       = @(
                @{ Name = "POSTGRES_DB"; Value = "teur" }
                @{ Name = "POSTGRES_USER"; Value = "teur" }
                @{ Name = "POSTGRES_PASSWORD"; Value = "changeme" }
            )
        },
        @{
            Name      = "prometheus"
            Image     = "prom/prometheus:v2.48.1"
            Port      = 9090
            Namespace = "obs-global"
        },
        @{
            Name      = "besu-ecb-core"
            Image     = "hyperledger/besu:24.1.0"
            Port      = 8545
            Namespace = "teur-csp"
        },
        @{
            Name      = "api"
            Image     = "$($Config.Registry)/api:latest"
            Port      = 3000
            Namespace = "teur-csp"
        },
        @{
            Name      = "dashboard"
            Image     = "$($Config.Registry)/dashboard:latest"
            Port      = 80
            Namespace = "teur-pap"
        },
        @{
            Name      = "iso20022-adapter"
            Image     = "$($Config.Registry)/iso20022-adapter:latest"
            Port      = 4000
            Namespace = "teur-csp"
        }
    )

    foreach ($service in $services) {
        Write-Host "Deploying service: $($service.Name)"

        # Create deployment
        $deployment = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $($service.Name)
  namespace: $($service.Namespace)
spec:
  replicas: 1
  selector:
    matchLabels:
      app: $($service.Name)
  template:
    metadata:
      labels:
        app: $($service.Name)
    spec:
      containers:
      - name: $($service.Name)
        image: $($service.Image)
        ports:
        - containerPort: $($service.Port)
"@

        if ($service.Env) {
            $envVars = $service.Env | ForEach-Object {
                "        - name: $($_.Name)`n          value: `"$($_.Value)`""
            }
            $deployment += "`n        env:`n" + ($envVars -join "`n")
        }

        $deployment += @"

---
apiVersion: v1
kind: Service
metadata:
  name: $($service.Name)
  namespace: $($service.Namespace)
spec:
  selector:
    app: $($service.Name)
  ports:
  - port: $($service.Port)
    targetPort: $($service.Port)
  type: ClusterIP
"@

        $tempFile = "$env:TEMP\$($service.Name)-deployment.yaml"
        $deployment | Out-File -FilePath $tempFile -Encoding UTF8
        kubectl apply -f $tempFile
    }

    Write-Host "All services deployed." -ForegroundColor Green
}

function Wait-ForServices {
    Write-Step "Waiting for Services to be Ready"

    Write-Host "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment --all --all-namespaces

    Write-Host "Services are ready." -ForegroundColor Green
}

function Show-Status {
    Write-Step "Deployment Status"

    Write-Host "Cluster info:" -ForegroundColor Yellow
    kubectl cluster-info

    Write-Host "`nNamespaces:" -ForegroundColor Yellow
    kubectl get namespaces

    Write-Host "`nPods:" -ForegroundColor Yellow
    kubectl get pods --all-namespaces

    Write-Host "`nServices:" -ForegroundColor Yellow
    kubectl get services --all-namespaces

    Write-Host "`nAccess URLs:" -ForegroundColor Yellow
    Write-Host "API: http://localhost:3000"
    Write-Host "Dashboard: http://localhost:3001"
    Write-Host "ISO20022 Adapter: http://localhost:4000"
    Write-Host "Prometheus: http://localhost:9090"
    Write-Host "Besu RPC: http://localhost:8545"
    Write-Host "PostgreSQL: localhost:5432"
}

# Main execution
try {
    Write-Host "tEUR Kind Deployment Script" -ForegroundColor Magenta
    Write-Host "==========================" -ForegroundColor Magenta

    Test-Prerequisites

    if ($Clean) {
        Remove-ExistingCluster
        exit 0
    }

    if (!$SkipCluster) {
        Remove-ExistingCluster
        New-KindCluster
    }

    if (!$SkipBuild) {
        Build-DockerImages
    }

    Import-ImagesToKind
    Install-KubernetesResources
    Deploy-Services
    Wait-ForServices
    Show-Status

    Write-Host "`n🎉 tEUR deployment completed successfully!" -ForegroundColor Green
    Write-Host "Use 'kubectl get pods --all-namespaces' to check status." -ForegroundColor Cyan

}
catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    exit 1
}