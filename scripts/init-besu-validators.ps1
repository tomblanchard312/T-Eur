# tEUR Besu Validator Initialization Script
# Generates validator keys and configures QBFT genesis

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Configuration
$Namespace = "ledger-ecb-core"
$ValidatorCount = 4
$ChainId = 31337
$BlockPeriod = 2
$TempDir = Join-Path $env:TEMP "teur-besu-init"

Write-Host "=== tEUR Besu Validator Initialization ===" -ForegroundColor Cyan
Write-Host "Namespace: $Namespace"
Write-Host "Validator Count: $ValidatorCount"
Write-Host "Chain ID: $ChainId"
Write-Host ""

# Clean up temp directory
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

# Create QBFT config template
$qbftConfig = @"
{
  "genesis": {
    "config": {
      "chainId": $ChainId,
      "berlinBlock": 0,
      "londonBlock": 0,
      "qbft": {
        "blockperiodseconds": $BlockPeriod,
        "epochlength": 30000,
        "requesttimeoutseconds": 4
      }
    },
    "nonce": "0x0",
    "timestamp": "0x0",
    "gasLimit": "0x1fffffffffffff",
    "difficulty": "0x1",
    "mixHash": "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
    "coinbase": "0x0000000000000000000000000000000000000000",
    "alloc": {}
  },
  "blockchain": {
    "nodes": {
      "generate": true,
      "count": $ValidatorCount
    }
  }
}
"@

$configPath = Join-Path $TempDir "qbftConfigFile.json"
$qbftConfig | Out-File -FilePath $configPath -Encoding utf8

Write-Host "Generating validator keys using Besu..." -ForegroundColor Yellow

# Run Besu in a pod to generate the keys
$generateJob = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: besu-keygen
  namespace: $Namespace
spec:
  ttlSecondsAfterFinished: 60
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
          cat > /tmp/qbftConfigFile.json << 'EOFCONFIG'
$qbftConfig
EOFCONFIG
          besu operator generate-blockchain-config --config-file=/tmp/qbftConfigFile.json --to=/tmp/networkFiles --private-key-file-name=key
          echo "=== GENESIS ==="
          cat /tmp/networkFiles/genesis.json
          echo ""
          echo "=== KEYS ==="
          for dir in /tmp/networkFiles/keys/*; do
            addr=\$(basename \$dir)
            echo "--- VALIDATOR \$addr ---"
            echo "ADDRESS: \$addr"
            echo "KEY:"
            cat \$dir/key
            echo ""
            echo "PUBKEY:"
            cat \$dir/key.pub
            echo ""
          done
"@

$jobPath = Join-Path $TempDir "keygen-job.yaml"
$generateJob | Out-File -FilePath $jobPath -Encoding utf8

Write-Host "Creating key generation job..." -ForegroundColor Yellow

# Delete existing job if present
kubectl delete job besu-keygen -n $Namespace 2>$null

# Apply the job
kubectl apply -f $jobPath

Write-Host "Waiting for key generation to complete..." -ForegroundColor Yellow
kubectl wait --for=condition=complete job/besu-keygen -n $Namespace --timeout=120s

# Get the logs
$logs = kubectl logs job/besu-keygen -n $Namespace

# Parse genesis from logs
$genesisStart = $logs.IndexOf("=== GENESIS ===")
$keysStart = $logs.IndexOf("=== KEYS ===")

if ($genesisStart -lt 0 -or $keysStart -lt 0) {
    Write-Host "ERROR: Failed to parse generated output" -ForegroundColor Red
    Write-Host $logs
    exit 1
}

$genesisJson = $logs.Substring($genesisStart + 16, $keysStart - $genesisStart - 16).Trim()

# Save genesis to file
$genesisPath = Join-Path $TempDir "genesis.json"
$genesisJson | Out-File -FilePath $genesisPath -Encoding utf8

Write-Host "Generated genesis file saved to: $genesisPath" -ForegroundColor Green

# Parse validator keys
$keysSection = $logs.Substring($keysStart)
$validatorBlocks = $keysSection -split "--- VALIDATOR"

$validators = @()
foreach ($block in $validatorBlocks) {
    if ($block -match "ADDRESS:\s*(0x[a-fA-F0-9]+)") {
        $address = $matches[1]
    }
    if ($block -match "KEY:\s*([a-fA-F0-9]+)") {
        $privateKey = $matches[1]
    }
    if ($block -match "PUBKEY:\s*([a-fA-F0-9]+)") {
        $publicKey = $matches[1]
    }
    if ($address -and $privateKey) {
        $validators += @{
            address    = $address
            privateKey = $privateKey
            publicKey  = $publicKey
        }
        $address = $null
        $privateKey = $null
        $publicKey = $null
    }
}

Write-Host "Found $($validators.Count) validators" -ForegroundColor Green

# Update the genesis ConfigMap
Write-Host "Updating genesis ConfigMap..." -ForegroundColor Yellow

kubectl create configmap besu-genesis `
    --from-file=genesis.json=$genesisPath `
    -n $Namespace `
    --dry-run=client -o yaml | kubectl apply -f -

# Create secrets for each validator
Write-Host "Creating validator key secrets..." -ForegroundColor Yellow

for ($i = 0; $i -lt $validators.Count; $i++) {
    $v = $validators[$i]
    $secretName = "besu-validator-$i-keys"
    
    # Create temp files for the keys
    $keyPath = Join-Path $TempDir "key-$i"
    $pubKeyPath = Join-Path $TempDir "key-$i.pub"
    
    $v.privateKey | Out-File -FilePath $keyPath -Encoding ascii -NoNewline
    $v.publicKey | Out-File -FilePath $pubKeyPath -Encoding ascii -NoNewline
    
    kubectl create secret generic $secretName `
        --from-file=key=$keyPath `
        --from-file=key.pub=$pubKeyPath `
        -n $Namespace `
        --dry-run=client -o yaml | kubectl apply -f -
    
    Write-Host "  Created secret: $secretName for address $($v.address)" -ForegroundColor Green
}

# Now we need to update the StatefulSet to mount keys correctly
Write-Host "Updating StatefulSet to use validator keys..." -ForegroundColor Yellow

# Patch the statefulset to restart pods with new config
kubectl rollout restart statefulset/besu-validator -n $Namespace

Write-Host "Waiting for validators to restart..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check status
kubectl get pods -n $Namespace

Write-Host ""
Write-Host "=== Initialization Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Validators are restarting with new genesis and keys."
Write-Host "Run 'kubectl get pods -n $Namespace -w' to watch the rollout."
Write-Host ""
Write-Host "To check validator logs:"
Write-Host "  kubectl logs besu-validator-0 -n $Namespace -f"

# Cleanup
Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
