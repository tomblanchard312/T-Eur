# Ledger Node Module

This module deploys a Hyperledger Besu validator node for tEUR settlement.

## Usage

```hcl
module "ledger_node" {
  source = "../../modules/ledger-node"

  zone_name   = "ecb-core"
  environment = "lab"
  role        = "validator"
  replicas    = 4

  genesis_config = {
    chain_id     = 1337
    block_period = 2
  }
}
```

## Requirements

- Kubernetes cluster
- Persistent storage class

## Inputs

| Name | Description | Type | Required |
|------|-------------|------|----------|
| zone_name | Zone identifier | string | yes |
| environment | Environment name | string | yes |
| role | Node role (validator, bootnode) | string | yes |
| replicas | Number of nodes | number | yes |

## Outputs

| Name | Description |
|------|-------------|
| service_name | Kubernetes service name |
| rpc_endpoint | JSON-RPC endpoint |
