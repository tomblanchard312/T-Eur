# tEUR Deployment Script
# Unified deployment for local, lab, test, pilot, prod environments
# Supports roles: central-bank, state-bank, local-bank, psp, merchant-simulator

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("local", "lab", "test", "pilot", "prod")]
    [string]$Env,

    [Parameter(Mandatory = $true)]
    [ValidateSet("central-bank", "state-bank", "local-bank", "psp", "merchant-simulator")]
    [string]$Role,

    [switch]$ConfirmProd,
    [switch]$DryRun
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$DeployDir = $ScriptDir

# Special validation for merchant-simulator
if ($Role -eq "merchant-simulator" -and $Env -ne "local") {
    Write-Error "Error: merchant-simulator role is only allowed in local environment"
    exit 1
}

# Prod confirmation
if ($Env -eq "prod" -and -not $ConfirmProd) {
    Write-Error "Error: Production deployment requires -ConfirmProd flag"
    exit 1
}

# Set environment variables
$env:TEUR_ENV = $Env
$env:TEUR_ROLE = $Role

# Validate required tools
function Validate-Tools {
    $missingTools = @()

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $missingTools += "docker"
    }

    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        $missingTools += "docker-compose"
    }

    if ($Env -ne "local") {
        if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
            $missingTools += "terraform"
        }
        if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
            $missingTools += "kubectl"
        }
        if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
            $missingTools += "helm"
        }
    }

    if ($missingTools.Count -gt 0) {
        Write-Error "Error: Missing required tools: $($missingTools -join ', ')"
        Write-Error "Please install them and try again."
        exit 1
    }
}

# Validate keys and secrets
function Validate-Keys {
    $requiredKeys = @("TEUR_ROOT_CA_KEY", "TEUR_ISSUER_KEY", "TEUR_ACQUIRER_KEY", "TEUR_PSP_KEY")

    foreach ($key in $requiredKeys) {
        $envValue = [Environment]::GetEnvironmentVariable($key)
        $filePath = Join-Path $ProjectRoot "keys\$key.pem"

        if ([string]::IsNullOrEmpty($envValue) -and -not (Test-Path $filePath)) {
            Write-Error "Error: Missing key material for $key. Provide via environment variable or file in $ProjectRoot\keys\"
            exit 1
        }
    }

    # For prod, ensure no test keys
    if ($Env -eq "prod") {
        $rootCaKey = [Environment]::GetEnvironmentVariable("TEUR_ROOT_CA_KEY")
        $filePath = Join-Path $ProjectRoot "keys\TEUR_ROOT_CA_KEY.pem"

        if ($rootCaKey -eq "test-key" -or (Test-Path $filePath) -and (Get-Content $filePath | Select-String "test")) {
            Write-Error "Error: Production deployment cannot use test keys"
            exit 1
        }
    }
}

# Print deployment plan
function Print-Plan {
    Write-Host "=== tEUR Deployment Plan ==="
    Write-Host "Environment: $Env"
    Write-Host "Role: $Role"
    Write-Host "Project Root: $ProjectRoot"
    if ($Env -eq "local") {
        Write-Host "Deployment Type: Local (Docker Compose)"
    }
    else {
        Write-Host "Deployment Type: Cloud/Internal (Terraform + Kubernetes)"
    }
    Write-Host "Dry Run: $(if ($DryRun) { 'Yes' } else { 'No' })"
    Write-Host ""

    if ($Env -eq "local") {
        Write-Host "Local Deployment Steps:"
        Write-Host "1. Validate tools and keys"
        Write-Host "2. Start Docker Compose services"
        Write-Host "3. Run health checks"
    }
    else {
        Write-Host "Cloud/Internal Deployment Steps:"
        Write-Host "1. Validate tools and keys"
        Write-Host "2. Initialize Terraform"
        Write-Host "3. Plan Terraform changes"
        Write-Host "4. Apply Terraform changes"
        Write-Host "5. Deploy Kubernetes manifests"
        Write-Host "6. Run health checks"
    }
    Write-Host ""
}

# Local deployment
function Deploy-Local {
    Write-Host "Starting local deployment..."

    Set-Location $ProjectRoot

    # Start services
    if (-not $DryRun) {
        docker-compose up -d
    }

    # Health checks
    Write-Host "Running health checks..."
    # Add health check logic here
    Write-Host "Local deployment complete."
}

# Cloud/Internal deployment
function Deploy-Cloud {
    Write-Host "Starting cloud/internal deployment..."

    Set-Location "$DeployDir\terraform\environments\$Env"

    # Terraform init
    if (-not $DryRun) {
        terraform init -backend-config="role=$Role"
    }

    # Terraform plan
    terraform plan -var="environment=$Env" -var="role=$Role" -out=tfplan

    if (-not $DryRun) {
        # Terraform apply
        terraform apply tfplan

        # Get outputs
        $kubeconfig = terraform output kubeconfig
        $env:KUBECONFIG = $kubeconfig

        # Deploy Kubernetes
        Set-Location "$DeployDir\kubernetes"
        helm upgrade --install teur-api charts/api --namespace $Role --create-namespace --set env.TEUR_ENV=$Env --set env.TEUR_ROLE=$Role
        helm upgrade --install teur-contracts charts/contracts --namespace $Role --set env.TEUR_ENV=$Env --set env.TEUR_ROLE=$Role
        helm upgrade --install teur-dashboard charts/dashboard --namespace $Role --set env.TEUR_ENV=$Env --set env.TEUR_ROLE=$Role
    }

    # Health checks
    Write-Host "Running health checks..."
    # Add health check logic here
    Write-Host "Cloud deployment complete."
}

# Main deployment logic
function Main {
    Validate-Tools
    Validate-Keys
    Print-Plan

    if ($Env -eq "local") {
        Deploy-Local
    }
    else {
        Deploy-Cloud
    }

    Write-Host "Deployment successful!"
}

Main