# tEUR Deployment Guide

This guide explains how to deploy the tEUR platform using the unified deployment system.

## Overview

The tEUR platform supports deployment to multiple environments with different roles. The deployment system provides a single command interface that works across Linux, Windows, and CI/CD pipelines.

## Environments

- **local**: Local development using Docker Compose
- **lab**: Testing environment
- **test**: Integration testing
- **pilot**: Pre-production
- **prod**: Production

## Roles

- **central-bank**: Core settlement infrastructure
- **state-bank**: State-level banking operations
- **local-bank**: Local banking operations
- **psp**: Payment service providers
- **merchant-simulator**: Local testing only

## Prerequisites

- Docker and Docker Compose
- For non-local: Terraform, kubectl, cloud CLI (if applicable)
- Key material (see Key Management)

## Local Deployment

For local development:

```bash
./deploy/deploy.sh --env local --role psp
```

Or on Windows:

```powershell
.\deploy\deploy.ps1 -Env local -Role psp
```

This starts all services using Docker Compose.

## Cloud/Internal Deployment

For cloud or internal deployments:

```bash
./deploy/deploy.sh --env prod --role central-bank --confirm-prod
```

### Key Management

Keys must be provided via:

1. Environment variables:

   ```bash
   export TEUR_ROOT_CA_KEY="..."
   export TEUR_ISSUER_KEY="..."
   export TEUR_ACQUIRER_KEY="..."
   export TEUR_PSP_KEY="..."
   ```

2. Files in `keys/` directory:
   - `keys/TEUR_ROOT_CA_KEY.pem`
   - etc.

For production, never use test keys.

### CI/CD Deployment

Use the GitHub Actions workflow with manual dispatch.

Select environment, role, and confirm for prod.

Secrets are injected from GitHub secrets.

## Architecture

- **Terraform**: Infrastructure as code for cloud resources
- **Kubernetes**: Container orchestration with Helm charts
- **Network Policies**: Enforce CSP isolation
- **mTLS**: Required in Closed Settlement Plane

## Directory Structure

```
deploy/
├── deploy.sh              # Linux/Mac deployment script
├── deploy.ps1             # Windows deployment script
├── terraform/
│   ├── modules/           # Reusable Terraform modules
│   └── environments/      # Environment-specific configs
├── kubernetes/
│   └── charts/            # Helm charts for services
├── scripts/
│   ├── validate.sh        # Pre-deployment validation
│   └── bootstrap.sh       # Initial setup
└── docs/
    └── README.md          # This file
```

## Safety Features

- Explicit environment and role selection
- Key validation before deployment
- Prod confirmation required
- No interactive prompts in CI
- Deterministic behavior
- CSP never uses public DNS

## Troubleshooting

- Check tool versions with `validate.sh`
- Review Terraform plans
- Check Kubernetes logs
- Ensure keys are properly injected
