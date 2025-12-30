# Kubernetes Base Manifests

Base Kubernetes configurations for tEUR infrastructure.

## Structure

```
k8s/base/
├── namespaces/     # Namespace definitions
├── network/        # NetworkPolicy base configs
├── observability/  # Prometheus, Grafana configs
└── security/       # RBAC, PodSecurityPolicies
```

## Usage

These manifests are applied via Terraform modules or directly via kubectl for initial cluster setup.

```bash
kubectl apply -k k8s/base/
```
