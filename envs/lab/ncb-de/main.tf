# Lab Environment - NCB-DE Zone
# German National Central Bank development configuration

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

  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "kubernetes" {
  config_path    = var.kubeconfig_path
  config_context = var.kubeconfig_context
}

provider "tls" {}

locals {
  environment = "lab"
  zone_name   = "ncb-de"

  common_labels = {
    "teur.eu/environment" = local.environment
    "teur.eu/zone"        = local.zone_name
    "teur.eu/managed-by"  = "terraform"
  }
}

# DNS Authoritative Server for NCB-DE
module "dns_authoritative" {
  source = "../../../modules/dns-authoritative"

  zone_name   = local.zone_name
  environment = local.environment
  replicas    = 1

  zones = {
    "ncb-de.csp.eu.int" = {
      records = [
        {
          name  = "ledger"
          type  = "A"
          ttl   = 300
          value = "10.1.0.10"
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

# Ledger Node (connects to ECB Core network)
module "ledger_node" {
  source = "../../../modules/ledger-node"

  zone_name   = local.zone_name
  environment = local.environment
  role        = "validator"
  replicas    = 2 # NCB has fewer validators than ECB Core

  genesis_config = {
    chain_id     = 31337 # Same as ECB Core
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
}
