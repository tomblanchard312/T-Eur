#!/usr/bin/env pwsh
# tEUR Besu Validator Bootstrap Script
# Generates QBFT validator keys and genesis file, then creates Kubernetes secrets

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Configuration
$Namespace = "ledger-ecb-core"
$ValidatorCount = 4
$ChainId = 31337
$BlockPeriod = 2

Write-Host "=== tEUR Besu QBFT Bootstrap ===" -ForegroundColor Cyan
Write-Host "Namespace: $Namespace"
Write-Host "Validator Count: $ValidatorCount"
Write-Host "Chain ID: $ChainId"
Write-Host ""

# Ensure namespace exists
Write-Host "Creating namespace if needed..." -ForegroundColor Yellow
kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -

# Create a Job to generate QBFT configuration

$jobYaml = @'
apiVersion: batch/v1
kind: Job
metadata:
  name: besu-bootstrap
  namespace: NAMESPACE_PLACEHOLDER
spec:
  ttlSecondsAfterFinished: 300
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: besu
        image: hyperledger/besu:24.1.0
        command:
        - /bin/sh
        - -c
        - |
          cat > /tmp/qbftConfigFile.json << 'QBFTEOF'
          CONFIG_PLACEHOLDER
          QBFTEOF
          besu operator generate-blockchain-config --config-file=/tmp/qbftConfigFile.json --to=/tmp/networkFiles --private-key-file-name=key
          echo "===GENESIS_START==="
          cat /tmp/networkFiles/genesis.json
          echo ""
          echo "===GENESIS_END==="
          echo "===KEYS_START==="
          i=0
          for dir in /tmp/networkFiles/keys/*; do
            addr=$(basename $dir)
            key=$(cat $dir/key)
            pubkey=$(cat $dir/key.pub)
            echo "VALIDATOR_${i}:${addr}:${key}:${pubkey}"
            i=$((i+1))
          done
          echo "===KEYS_END==="
'@

# Build the QBFT config
$qbftConfig = @{
    genesis    = @{
        config     = @{
            chainId     = $ChainId
            berlinBlock = 0
            londonBlock = 0
            qbft        = @{
                blockperiodseconds    = $BlockPeriod
                epochlength           = 30000
                requesttimeoutseconds = 4
            }
        }
        nonce      = "0x0"
        timestamp  = "0x0"
        gasLimit   = "0x1fffffffffffff"
        difficulty = "0x1"
        mixHash    = "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365"
        coinbase   = "0x0000000000000000000000000000000000000000"
        alloc      = @{}
    }
    blockchain = @{
        nodes = @{
            generate = $true
            count    = $ValidatorCount
        }
    }
} | ConvertTo-Json -Depth 10 -Compress

# Replace placeholders
$jobYaml = $jobYaml -replace "NAMESPACE_PLACEHOLDER", $Namespace
$jobYaml = $jobYaml -replace "CONFIG_PLACEHOLDER", $qbftConfig

Write-Host "Running Besu key generation job..." -ForegroundColor Yellow

# Delete existing job if present
kubectl delete job besu-bootstrap -n $Namespace --ignore-not-found 2>$null

# Apply the job
$jobYaml | kubectl apply -f -

Write-Host "Waiting for bootstrap job to complete..." -ForegroundColor Yellow
$timeout = 120
$elapsed = 0
while ($elapsed -lt $timeout) {
    $status = kubectl get job besu-bootstrap -n $Namespace -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>$null
    if ($status -eq "True") {
        Write-Host "Job completed successfully" -ForegroundColor Green
        break
    }
    $failed = kubectl get job besu-bootstrap -n $Namespace -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>$null
    if ($failed -eq "True") {
        Write-Host "Job failed!" -ForegroundColor Red
        kubectl logs job/besu-bootstrap -n $Namespace
        exit 1
    }
    Start-Sleep -Seconds 2
    $elapsed += 2
    Write-Host "  Waiting... ($elapsed/$timeout seconds)"
}

if ($elapsed -ge $timeout) {
    Write-Host "Timeout waiting for job" -ForegroundColor Red
    exit 1
}

# Get the logs as a single string
$logsArray = kubectl logs job/besu-bootstrap -n $Namespace
$logs = $logsArray -join "`n"

# Parse genesis using regex for robustness
if ($logs -match '===GENESIS_START===\s*([\s\S]*?)\s*===GENESIS_END===') {
    $genesisJson = $matches[1].Trim()
}
else {
    Write-Host "ERROR: Could not find genesis in output" -ForegroundColor Red
    Write-Host $logs
    exit 1
}

Write-Host "Genesis file extracted ($($genesisJson.Length) bytes)" -ForegroundColor Green

# Parse keys using regex
$validators = @()
$keyMatches = [regex]::Matches($logs, 'VALIDATOR_(\d+):([^:]+):([^:]+):([^\s]+)')
foreach ($match in $keyMatches) {
    $validators += @{
        index      = [int]$match.Groups[1].Value
        address    = $match.Groups[2].Value
        privateKey = $match.Groups[3].Value
        publicKey  = $match.Groups[4].Value
    }
}

Write-Host "Extracted $($validators.Count) validator keys" -ForegroundColor Green

# Create genesis ConfigMap
Write-Host "Creating genesis ConfigMap..." -ForegroundColor Yellow
$tempGenesis = [System.IO.Path]::GetTempFileName()
$genesisJson | Out-File -FilePath $tempGenesis -Encoding utf8 -NoNewline

kubectl create configmap besu-genesis `
    --from-file=genesis.json=$tempGenesis `
    -n $Namespace `
    --dry-run=client -o yaml | kubectl apply -f -

Remove-Item $tempGenesis -ErrorAction SilentlyContinue

# Create validator key secrets
Write-Host "Creating validator key secrets..." -ForegroundColor Yellow
foreach ($v in $validators) {
    $secretName = "besu-validator-$($v.index)-keys"
    
    $tempKey = [System.IO.Path]::GetTempFileName()
    $tempPubKey = [System.IO.Path]::GetTempFileName()
    
    $v.privateKey | Out-File -FilePath $tempKey -Encoding ascii -NoNewline
    $v.publicKey | Out-File -FilePath $tempPubKey -Encoding ascii -NoNewline
    
    kubectl create secret generic $secretName `
        --from-file=key=$tempKey `
        --from-file=key.pub=$tempPubKey `
        -n $Namespace `
        --dry-run=client -o yaml | kubectl apply -f -
    
    Write-Host "  Created: $secretName (address: $($v.address))" -ForegroundColor Green
    
    Remove-Item $tempKey, $tempPubKey -ErrorAction SilentlyContinue
}

# Cleanup job
kubectl delete job besu-bootstrap -n $Namespace --ignore-not-found

Write-Host ""
Write-Host "=== Bootstrap Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Genesis and validator keys have been created in namespace '$Namespace'."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Run 'terraform apply' to create the Besu StatefulSet"
Write-Host "  2. The validators will start and form consensus"
Write-Host ""
Write-Host "To verify:"
Write-Host "  kubectl get pods -n $Namespace"
Write-Host "  kubectl logs besu-validator-0 -n $Namespace -f"
