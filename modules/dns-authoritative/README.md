# DNS Authoritative Module

This module deploys an authoritative DNS server for CSP (Closed Settlement Plane) zones.

## Usage

```hcl
module "dns_authoritative" {
  source = "../../modules/dns-authoritative"

  zone_name   = "ecb-core"
  environment = "lab"
  replicas    = 2

  zones = {
    "ecb-core.csp.eu.int" = {
      records = []
    }
  }
}
```

## Requirements

- Kubernetes cluster
- CoreDNS or similar DNS server image

## Inputs

| Name | Description | Type | Required |
|------|-------------|------|----------|
| zone_name | Zone identifier | string | yes |
| environment | Environment name | string | yes |
| replicas | Number of replicas | number | yes |
| zones | DNS zone configurations | map | yes |

## Outputs

| Name | Description |
|------|-------------|
| service_name | Kubernetes service name |
| cluster_ip | Cluster IP address |
