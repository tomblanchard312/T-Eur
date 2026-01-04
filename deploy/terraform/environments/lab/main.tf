terraform {
  backend "s3" {
    bucket = "teur-terraform-state"
    key    = "lab/${var.role}/terraform.tfstate"
    region = "us-east-1"
  }
}

variable "environment" {
  type = string
}

variable "role" {
  type = string
}

variable "root_ca_key" {
  type      = string
  sensitive = true
}

variable "issuer_key" {
  type      = string
  sensitive = true
}

variable "acquirer_key" {
  type      = string
  sensitive = true
}

variable "psp_key" {
  type      = string
  sensitive = true
}

module "api" {
  source = "../../modules/api"

  environment = var.environment
  role        = var.role

  root_ca_key   = var.root_ca_key
  issuer_key    = var.issuer_key
  acquirer_key  = var.acquirer_key
  psp_key       = var.psp_key
}

module "contracts" {
  source = "../../modules/contracts"

  environment = var.environment
  role        = var.role

  root_ca_key = var.root_ca_key
  issuer_key  = var.issuer_key
}

module "dashboard" {
  source = "../../modules/dashboard"

  environment = var.environment
  role        = var.role
}

# Add other modules as needed

output "kubeconfig" {
  value     = module.kubernetes.kubeconfig
  sensitive = true
}

# Assume a kubernetes module for cluster setup
module "kubernetes" {
  source = "../../modules/kubernetes"

  environment = var.environment
  role        = var.role
}