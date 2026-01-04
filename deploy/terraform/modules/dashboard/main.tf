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

resource "kubernetes_deployment" "dashboard" {
  metadata {
    name      = "teur-dashboard"
    namespace = var.role
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "teur-dashboard"
      }
    }

    template {
      metadata {
        labels = {
          app = "teur-dashboard"
        }
      }

      spec {
        container {
          name  = "dashboard"
          image = "teur/dashboard:${var.image_tag}"

          env {
            name  = "TEUR_ENV"
            value = var.environment
          }

          env {
            name  = "TEUR_ROLE"
            value = var.role
          }

          port {
            container_port = 80
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "dashboard" {
  metadata {
    name      = "teur-dashboard"
    namespace = var.role
  }

  spec {
    selector = {
      app = "teur-dashboard"
    }

    port {
      port        = 80
      target_port = 80
    }

    type = var.environment == "local" ? "ClusterIP" : "LoadBalancer"
  }
}

# Network policy for dashboard (PAP access)
resource "kubernetes_network_policy" "dashboard" {
  metadata {
    name      = "dashboard-network-policy"
    namespace = var.role
  }

  spec {
    pod_selector {
      match_labels = {
        app = "teur-dashboard"
      }
    }

    policy_types = ["Ingress"]

    ingress {
      # Allow from ingress or external
      from {
        ip_block {
          cidr = "0.0.0.0/0"
        }
      }

      ports {
        port     = "80"
        protocol = "TCP"
      }
    }
  }
}