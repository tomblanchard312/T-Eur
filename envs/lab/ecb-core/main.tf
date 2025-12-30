# Lab Environment - ECB Core Zone
# Local development configuration

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0.0"
    }
  }

  # Local backend for lab environment
  # Each zone maintains its own state file
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "kubernetes" {
  config_path    = var.kubeconfig_path
  config_context = var.kubeconfig_context
}

provider "tls" {}

# Local variables
locals {
  environment = "lab"
  zone_name   = "ecb-core"

  common_labels = {
    "teur.eu/environment" = local.environment
    "teur.eu/zone"        = local.zone_name
    "teur.eu/managed-by"  = "terraform"
  }
}

# PKI Root CA
module "pki_root" {
  source = "../../../modules/pki-root"

  zone_name    = local.zone_name
  environment  = local.environment
  organization = "tEUR Lab - ECB"

  validity_years = 5
}

# DNS Authoritative Server
module "dns_authoritative" {
  source = "../../../modules/dns-authoritative"

  zone_name   = local.zone_name
  environment = local.environment
  replicas    = var.dns_replicas

  zones = {
    "ecb-core.csp.eu.int" = {
      records = [
        {
          name  = "ledger"
          type  = "A"
          ttl   = 300
          value = "10.0.0.10"
        }
      ]
    }
  }

  resources = {
    requests = {
      cpu    = "50m"
      memory = "64Mi"
    }
    limits = {
      cpu    = "200m"
      memory = "128Mi"
    }
  }
}

# Ledger Nodes (Besu Validators)
module "ledger_node" {
  source = "../../../modules/ledger-node"

  zone_name   = local.zone_name
  environment = local.environment
  role        = "validator"
  replicas    = var.validator_count

  genesis_config = {
    chain_id     = 31337 # Lab chain ID
    block_period = 2
  }

  storage_class = var.storage_class
  storage_size  = "10Gi"

  resources = {
    requests = {
      cpu    = "250m"
      memory = "1Gi"
    }
    limits = {
      cpu    = "1000m"
      memory = "2Gi"
    }
  }

  depends_on = [module.pki_root]
}
