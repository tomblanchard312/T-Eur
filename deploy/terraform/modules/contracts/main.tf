variable "environment" {
  type = string
}

variable "role" {
  type = string
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "root_ca_key" {
  type      = string
  sensitive = true
}

variable "issuer_key" {
  type      = string
  sensitive = true
}

resource "kubernetes_deployment" "contracts" {
  metadata {
    name      = "teur-contracts"
    namespace = var.role
  }

  spec {
    replicas = var.environment == "prod" ? 2 : 1

    selector {
      match_labels = {
        app = "teur-contracts"
      }
    }

    template {
      metadata {
        labels = {
          app = "teur-contracts"
        }
      }

      spec {
        container {
          name  = "contracts"
          image = "teur/contracts:${var.image_tag}"

          env {
            name  = "TEUR_ENV"
            value = var.environment
          }

          env {
            name  = "TEUR_ROLE"
            value = var.role
          }

          env {
            name  = "TEUR_ROOT_CA_KEY"
            value = var.root_ca_key
          }

          env {
            name  = "TEUR_ISSUER_KEY"
            value = var.issuer_key
          }

          port {
            container_port = 8545  # Assuming Ethereum RPC port
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "1Gi"
            }
            limits = {
              cpu    = "1000m"
              memory = "2Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "contracts" {
  metadata {
    name      = "teur-contracts"
    namespace = var.role
  }

  spec {
    selector = {
      app = "teur-contracts"
    }

    port {
      port        = 8545
      target_port = 8545
    }

    type = "ClusterIP"  # Internal only for CSP
  }
}

# Network policy for contracts (highly restricted)
resource "kubernetes_network_policy" "contracts" {
  metadata {
    name      = "contracts-network-policy"
    namespace = var.role
  }

  spec {
    pod_selector {
      match_labels = {
        app = "teur-contracts"
      }
    }

    policy_types = ["Ingress", "Egress"]

    ingress {
      from {
        pod_selector {
          match_labels = {
            app = "teur-api"
          }
        }
      }

      ports {
        port     = "8545"
        protocol = "TCP"
      }
    }

    egress {
      # Allow DNS
      to {
        namespace_selector {
          match_labels = {
            name = "kube-system"
          }
        }
      }

      ports {
        port     = "53"
        protocol = "UDP"
      }
    }
  }
}