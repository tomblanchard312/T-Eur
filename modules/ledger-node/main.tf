# Ledger Node Module
# Deploys Hyperledger Besu validator nodes for tEUR settlement

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23.0"
    }
  }
}

locals {
  namespace = "ledger-${var.zone_name}"
  labels = {
    "app.kubernetes.io/name"      = "besu-${var.role}"
    "app.kubernetes.io/component" = "ledger"
    "app.kubernetes.io/part-of"   = "teur"
    "teur.eu/zone"                = var.zone_name
    "teur.eu/environment"         = var.environment
  }
}

resource "kubernetes_namespace" "ledger" {
  metadata {
    name   = local.namespace
    labels = local.labels
  }
}

resource "kubernetes_secret" "node_keys" {
  count = var.replicas

  metadata {
    name      = "besu-${var.role}-${count.index}-keys"
    namespace = kubernetes_namespace.ledger.metadata[0].name
    labels    = local.labels
  }

  # Keys must be provided externally or generated via init container
  # Never store actual keys in Terraform state
  data = {}

  lifecycle {
    ignore_changes = [data]
  }
}

resource "kubernetes_config_map" "genesis" {
  metadata {
    name      = "besu-genesis"
    namespace = kubernetes_namespace.ledger.metadata[0].name
    labels    = local.labels
  }

  data = {
    "genesis.json" = jsonencode({
      config = {
        chainId                = var.genesis_config.chain_id
        berlinBlock            = 0
        londonBlock            = 0
        qbft = {
          blockperiodseconds = var.genesis_config.block_period
          epochlength        = 30000
          requesttimeoutseconds = 4
        }
      }
      nonce      = "0x0"
      timestamp  = "0x0"
      gasLimit   = "0x1fffffffffffff"
      difficulty = "0x1"
      mixHash    = "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365"
      coinbase   = "0x0000000000000000000000000000000000000000"
      alloc      = {}
      extraData  = "0x"
    })
  }
}

resource "kubernetes_config_map" "besu_config" {
  metadata {
    name      = "besu-config"
    namespace = kubernetes_namespace.ledger.metadata[0].name
    labels    = local.labels
  }

  data = {
    "config.toml" = <<-EOT
      # Besu configuration for tEUR ${var.zone_name}
      
      # Network
      genesis-file="/etc/besu/genesis.json"
      
      # P2P
      p2p-enabled=true
      p2p-host="0.0.0.0"
      p2p-port=30303
      
      # RPC
      rpc-http-enabled=true
      rpc-http-host="0.0.0.0"
      rpc-http-port=8545
      rpc-http-cors-origins=["*"]
      rpc-http-api=["ETH","NET","QBFT","ADMIN"]
      
      # WebSocket
      rpc-ws-enabled=true
      rpc-ws-host="0.0.0.0"
      rpc-ws-port=8546
      
      # Metrics
      metrics-enabled=true
      metrics-host="0.0.0.0"
      metrics-port=9545
      
      # Logging
      logging="INFO"
      
      # Data
      data-path="/data"
      
      # Security
      host-allowlist=["*"]
    EOT
  }
}

resource "kubernetes_stateful_set" "besu" {
  metadata {
    name      = "besu-${var.role}"
    namespace = kubernetes_namespace.ledger.metadata[0].name
    labels    = local.labels
  }

  spec {
    service_name = "besu-${var.role}"
    replicas     = var.replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "besu-${var.role}"
      }
    }

    template {
      metadata {
        labels = local.labels

        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "9545"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        # Anti-affinity: spread validators across nodes (preferred for lab compatibility)
        affinity {
          pod_anti_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100
              pod_affinity_term {
                label_selector {
                  match_labels = {
                    "app.kubernetes.io/name" = "besu-${var.role}"
                  }
                }
                topology_key = "kubernetes.io/hostname"
              }
            }
          }
        }

        # Topology spread for zone distribution
        topology_spread_constraint {
          max_skew           = 1
          topology_key       = "topology.kubernetes.io/zone"
          when_unsatisfiable = "ScheduleAnyway"
          label_selector {
            match_labels = {
              "app.kubernetes.io/name" = "besu-${var.role}"
            }
          }
        }

        # Init container to copy validator-specific keys
        init_container {
          name  = "init-keys"
          image = "busybox:1.36"

          command = ["/bin/sh", "-c", "ORDINAL=$(echo $HOSTNAME | rev | cut -d- -f1 | rev); echo Initializing keys for validator ordinal: $ORDINAL; if [ -f /validator-keys-$ORDINAL/key ]; then cp /validator-keys-$ORDINAL/key /keys/key; cp /validator-keys-$ORDINAL/key.pub /keys/key.pub 2>/dev/null || true; chmod 600 /keys/key; echo Keys copied successfully; else echo WARNING: No keys found, generating temporary key; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \\n' > /keys/key; fi"]

          volume_mount {
            name       = "keys"
            mount_path = "/keys"
          }

          dynamic "volume_mount" {
            for_each = range(var.replicas)
            content {
              name       = "validator-keys-${volume_mount.value}"
              mount_path = "/validator-keys-${volume_mount.value}"
              read_only  = true
            }
          }
        }

        container {
          name  = "besu"
          image = var.besu_image

          args = [
            "--config-file=/etc/besu/config.toml",
            "--node-private-key-file=/secrets/key"
          ]

          port {
            name           = "p2p-tcp"
            container_port = 30303
            protocol       = "TCP"
          }

          port {
            name           = "p2p-udp"
            container_port = 30303
            protocol       = "UDP"
          }

          port {
            name           = "rpc-http"
            container_port = 8545
            protocol       = "TCP"
          }

          port {
            name           = "rpc-ws"
            container_port = 8546
            protocol       = "TCP"
          }

          port {
            name           = "metrics"
            container_port = 9545
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
              path = "/liveness"
              port = 8545
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 10
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/readiness"
              port = 8545
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/besu/config.toml"
            sub_path   = "config.toml"
            read_only  = true
          }

          volume_mount {
            name       = "genesis"
            mount_path = "/etc/besu/genesis.json"
            sub_path   = "genesis.json"
            read_only  = true
          }

          volume_mount {
            name       = "keys"
            mount_path = "/secrets"
            read_only  = true
          }

          security_context {
            read_only_root_filesystem = false
            run_as_non_root           = true
            run_as_user               = 1000
            capabilities {
              drop = ["ALL"]
            }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.besu_config.metadata[0].name
          }
        }

        volume {
          name = "genesis"
          config_map {
            name = kubernetes_config_map.genesis.metadata[0].name
          }
        }

        # Ephemeral volume for copied keys
        volume {
          name = "keys"
          empty_dir {}
        }

        # Mount each validator's key secret separately
        dynamic "volume" {
          for_each = range(var.replicas)
          content {
            name = "validator-keys-${volume.value}"
            secret {
              secret_name = "besu-${var.role}-${volume.value}-keys"
              optional    = true
            }
          }
        }

        security_context {
          fs_group = 1000
        }

        termination_grace_period_seconds = 120
      }
    }

    volume_claim_template {
      metadata {
        name = "data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.storage_class

        resources {
          requests = {
            storage = var.storage_size
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "besu_headless" {
  metadata {
    name      = "besu-${var.role}"
    namespace = kubernetes_namespace.ledger.metadata[0].name
    labels    = local.labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "besu-${var.role}"
    }

    cluster_ip = "None"

    port {
      name        = "p2p-tcp"
      port        = 30303
      target_port = 30303
      protocol    = "TCP"
    }

    port {
      name        = "p2p-udp"
      port        = 30303
      target_port = 30303
      protocol    = "UDP"
    }

    port {
      name        = "rpc-http"
      port        = 8545
      target_port = 8545
      protocol    = "TCP"
    }
  }
}

resource "kubernetes_service" "besu_rpc" {
  metadata {
    name      = "besu-${var.role}-rpc"
    namespace = kubernetes_namespace.ledger.metadata[0].name
    labels    = local.labels

    annotations = {
      "prometheus.io/scrape" = "true"
      "prometheus.io/port"   = "9545"
    }
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "besu-${var.role}"
    }

    port {
      name        = "rpc-http"
      port        = 8545
      target_port = 8545
      protocol    = "TCP"
    }

    port {
      name        = "rpc-ws"
      port        = 8546
      target_port = 8546
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_pod_disruption_budget_v1" "besu" {
  metadata {
    name      = "besu-${var.role}"
    namespace = kubernetes_namespace.ledger.metadata[0].name
  }

  spec {
    # For QBFT consensus, maintain quorum
    # With 4 validators, need at least 3 (2f+1 where f=1)
    min_available = var.replicas > 3 ? var.replicas - 1 : 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "besu-${var.role}"
      }
    }
  }
}
