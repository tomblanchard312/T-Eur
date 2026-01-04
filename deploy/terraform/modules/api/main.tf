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

resource "kubernetes_deployment" "api" {
  metadata {
    name      = "teur-api"
    namespace = var.role
  }

  spec {
    replicas = var.environment == "prod" ? 3 : 1

    selector {
      match_labels = {
        app = "teur-api"
      }
    }

    template {
      metadata {
        labels = {
          app = "teur-api"
        }
      }

      spec {
        container {
          name  = "api"
          image = "teur/api:${var.image_tag}"

          env {
            name  = "TEUR_ENV"
            value = var.environment
          }

          env {
            name  = "TEUR_ROLE"
            value = var.role
          }

          # Add key injection here
          env {
            name  = "TEUR_ROOT_CA_KEY"
            value = var.root_ca_key
          }

          # Add other env vars

          port {
            container_port = 3000
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "api" {
  metadata {
    name      = "teur-api"
    namespace = var.role
  }

  spec {
    selector = {
      app = "teur-api"
    }

    port {
      port        = 80
      target_port = 3000
    }

    type = var.environment == "local" ? "ClusterIP" : "LoadBalancer"
  }
}

# Add network policies for CSP isolation
resource "kubernetes_network_policy" "api" {
  metadata {
    name      = "api-network-policy"
    namespace = var.role
  }

  spec {
    pod_selector {
      match_labels = {
        app = "teur-api"
      }
    }

    policy_types = ["Ingress", "Egress"]

    ingress {
      from {
        pod_selector {
          match_labels = {
            app = "teur-gateway"  # Only allow from gateway
          }
        }
      }

      ports {
        port     = "3000"
        protocol = "TCP"
      }
    }

    egress {
      to {
        pod_selector {
          match_labels = {
            app = "teur-database"
          }
        }
      }

      ports {
        port     = "5432"
        protocol = "TCP"
      }
    }
  }
}