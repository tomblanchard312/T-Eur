# PKI Root Module
# Deploys root Certificate Authority for mTLS infrastructure

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
}

locals {
  namespace = "pki-${var.zone_name}"
  labels = {
    "app.kubernetes.io/name"      = "pki-root"
    "app.kubernetes.io/component" = "security"
    "app.kubernetes.io/part-of"   = "teur"
    "teur.eu/zone"                = var.zone_name
    "teur.eu/environment"         = var.environment
  }
}

resource "kubernetes_namespace" "pki" {
  metadata {
    name   = local.namespace
    labels = local.labels
  }
}

# Root CA Private Key
# WARNING: In production, use HSM-backed key generation
resource "tls_private_key" "root_ca" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P384"
}

# Root CA Self-Signed Certificate
resource "tls_self_signed_cert" "root_ca" {
  private_key_pem = tls_private_key.root_ca.private_key_pem

  subject {
    common_name         = "tEUR Root CA - ${var.zone_name}"
    organization        = var.organization
    organizational_unit = "tEUR Infrastructure"
    country             = "EU"
  }

  validity_period_hours = var.validity_years * 365 * 24

  is_ca_certificate = true

  allowed_uses = [
    "cert_signing",
    "crl_signing",
    "digital_signature",
  ]

  # Key usage for CA
  set_subject_key_id = true
}

# Store CA certificate in Kubernetes secret
# Certificate is public and can be distributed
resource "kubernetes_secret" "root_ca_cert" {
  metadata {
    name      = "pki-root-ca-cert"
    namespace = kubernetes_namespace.pki.metadata[0].name
    labels    = local.labels

    annotations = {
      "teur.eu/secret-type" = "ca-certificate"
      "teur.eu/description" = "Root CA public certificate for trust chain"
    }
  }

  type = "kubernetes.io/tls"

  data = {
    "tls.crt" = tls_self_signed_cert.root_ca.cert_pem
    # Private key should NOT be stored in cluster in production
    # This is for lab/development only
    "tls.key" = var.environment == "lab" ? tls_private_key.root_ca.private_key_pem : ""
  }

  lifecycle {
    # Prevent accidental deletion
    prevent_destroy = false # Set to true in production
  }
}

# ConfigMap for CA certificate distribution
# This is the preferred way to distribute CA certs to workloads
resource "kubernetes_config_map" "root_ca_bundle" {
  metadata {
    name      = "pki-root-ca-bundle"
    namespace = kubernetes_namespace.pki.metadata[0].name
    labels    = local.labels

    annotations = {
      "teur.eu/description" = "Root CA certificate bundle for mTLS validation"
    }
  }

  data = {
    "ca.crt"     = tls_self_signed_cert.root_ca.cert_pem
    "ca-bundle.crt" = tls_self_signed_cert.root_ca.cert_pem
  }
}
