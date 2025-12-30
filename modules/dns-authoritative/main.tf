# DNS Authoritative Module
# Deploys authoritative DNS for CSP zones

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23.0"
    }
  }
}

resource "kubernetes_namespace" "dns" {
  metadata {
    name = "dns-${var.zone_name}"

    labels = {
      "app.kubernetes.io/name"       = "dns-authoritative"
      "app.kubernetes.io/component"  = "dns"
      "app.kubernetes.io/part-of"    = "teur"
      "teur.eu/zone"                 = var.zone_name
      "teur.eu/environment"          = var.environment
    }
  }
}

resource "kubernetes_config_map" "corefile" {
  metadata {
    name      = "dns-authoritative-corefile"
    namespace = kubernetes_namespace.dns.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "dns-authoritative"
      "app.kubernetes.io/component" = "config"
    }
  }

  data = {
    "Corefile" = templatefile("${path.module}/templates/Corefile.tftpl", {
      zones = var.zones
    })
  }
}

resource "kubernetes_deployment" "dns_authoritative" {
  metadata {
    name      = "dns-authoritative"
    namespace = kubernetes_namespace.dns.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "dns-authoritative"
      "app.kubernetes.io/component" = "dns"
      "app.kubernetes.io/part-of"   = "teur"
    }
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "dns-authoritative"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "dns-authoritative"
          "app.kubernetes.io/component" = "dns"
          "app.kubernetes.io/part-of"   = "teur"
        }
      }

      spec {
        # Anti-affinity: spread across nodes (preferred for lab compatibility)
        affinity {
          pod_anti_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100
              pod_affinity_term {
                label_selector {
                  match_labels = {
                    "app.kubernetes.io/name" = "dns-authoritative"
                  }
                }
                topology_key = "kubernetes.io/hostname"
              }
            }
          }
        }

        container {
          name  = "coredns"
          image = var.coredns_image

          args = ["-conf", "/etc/coredns/Corefile"]

          port {
            name           = "dns-tcp"
            container_port = 53
            protocol       = "TCP"
          }

          port {
            name           = "dns-udp"
            container_port = 53
            protocol       = "UDP"
          }

          port {
            name           = "metrics"
            container_port = 9153
            protocol       = "TCP"
          }

          resources {
            requests = {
              cpu    = var.resources.requests.cpu
              memory = var.resources.requests.memory
            }
            limits = {
              cpu    = var.resources.limits.cpu
              memory = var.resources.limits.memory
            }
          }

          liveness_probe {
            http_get {
              path   = "/health"
              port   = 8080
              scheme = "HTTP"
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path   = "/ready"
              port   = 8181
              scheme = "HTTP"
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/coredns"
            read_only  = true
          }

          security_context {
            read_only_root_filesystem = true
            run_as_non_root           = true
            run_as_user               = 1000
            capabilities {
              drop = ["ALL"]
              add  = ["NET_BIND_SERVICE"]
            }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.corefile.metadata[0].name
          }
        }

        security_context {
          fs_group = 1000
        }
      }
    }
  }
}

resource "kubernetes_service" "dns_authoritative" {
  metadata {
    name      = "dns-authoritative"
    namespace = kubernetes_namespace.dns.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "dns-authoritative"
      "app.kubernetes.io/component" = "dns"
    }

    annotations = {
      "prometheus.io/scrape" = "true"
      "prometheus.io/port"   = "9153"
    }
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "dns-authoritative"
    }

    port {
      name        = "dns-tcp"
      port        = 53
      target_port = 53
      protocol    = "TCP"
    }

    port {
      name        = "dns-udp"
      port        = 53
      target_port = 53
      protocol    = "UDP"
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_pod_disruption_budget_v1" "dns_authoritative" {
  metadata {
    name      = "dns-authoritative"
    namespace = kubernetes_namespace.dns.metadata[0].name
  }

  spec {
    min_available = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "dns-authoritative"
      }
    }
  }
}
