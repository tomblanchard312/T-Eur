# Lab Environment - ECB Core Zone

This is the local development environment for the ECB Core zone.

## Usage

```bash
terraform init
terraform plan
terraform apply
```

## Prerequisites

- Kubernetes cluster (kind, minikube, or similar)
- kubectl configured
- Terraform >= 1.5

## Components

- DNS Authoritative Server
- Ledger Nodes (4 validators)
- PKI Root CA
