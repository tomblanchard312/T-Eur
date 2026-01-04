# Guide de déploiement tEUR

Ce guide explique comment déployer la plateforme tEUR en utilisant le système de déploiement unifié.

## Vue d'ensemble

La plateforme tEUR prend en charge le déploiement dans plusieurs environnements avec différents rôles. Le système de déploiement fournit une interface de commande unique qui fonctionne sur Linux, Windows et les pipelines CI/CD.

## Environnements

- **local**: Développement local utilisant Docker Compose
- **lab**: Environnement de test
- **test**: Tests d'intégration
- **pilot**: Pré-production
- **prod**: Production

## Rôles

- **central-bank**: Infrastructure de règlement central
- **state-bank**: Opérations bancaires au niveau de l'État
- **local-bank**: Opérations bancaires locales
- **psp**: Fournisseurs de services de paiement
- **merchant-simulator**: Test local uniquement

## Prérequis

- Docker et Docker Compose
- Pour non-local: Terraform, kubectl, CLI cloud (le cas échéant)
- Matériel clé (voir Gestion des clés)

## Déploiement local

Pour le développement local:

```bash
./deploy/deploy.sh --env local --role psp
```

Ou sur Windows:

```powershell
.\deploy\deploy.ps1 -Env local -Role psp
```

Cela démarre tous les services en utilisant Docker Compose.

## Déploiement cloud/interne

Pour les déploiements cloud ou internes:

```bash
./deploy/deploy.sh --env prod --role central-bank --confirm-prod
```

### Gestion des clés

Les clés doivent être fournies via:

1. Variables d'environnement:

   ```bash
   export TEUR_ROOT_CA_KEY="..."
   export TEUR_ISSUER_KEY="..."
   export TEUR_ACQUIRER_KEY="..."
   export TEUR_PSP_KEY="..."
   ```

2. Fichiers dans le répertoire `keys/`:
   - `keys/TEUR_ROOT_CA_KEY.pem`
   - etc.

Pour la production, n'utilisez jamais de clés de test.

### Déploiement CI/CD

Utilisez le workflow GitHub Actions avec dispatch manuel.

Sélectionnez l'environnement, le rôle et confirmez pour prod.

Les secrets sont injectés depuis les secrets GitHub.

## Architecture

- **Terraform**: Infrastructure as code pour les ressources cloud
- **Kubernetes**: Orchestration de conteneurs avec des charts Helm
- **Politiques réseau**: Appliquent l'isolation CSP
- **mTLS**: Requis dans le plan de règlement fermé

## Structure des répertoires

```
deploy/
├── deploy.sh              # Script de déploiement Linux/Mac
├── deploy.ps1             # Script de déploiement Windows
├── terraform/
│   ├── modules/           # Modules Terraform réutilisables
│   └── environments/      # Configurations spécifiques à l'environnement
├── kubernetes/
│   └── charts/            # Charts Helm pour les services
├── scripts/
│   ├── validate.sh        # Validation pré-déploiement
│   └── bootstrap.sh       # Configuration initiale
└── docs/
    └── README.md          # Ce fichier
```

## Fonctionnalités de sécurité

- Sélection explicite d'environnement et de rôle
- Validation des clés avant le déploiement
- Confirmation prod requise
- Pas d'invites interactives en CI
- Comportement déterministe
- CSP n'utilise jamais de DNS public

## Dépannage

- Vérifiez les versions des outils avec `validate.sh`
- Examinez les plans Terraform
- Vérifiez les logs Kubernetes
- Assurez-vous que les clés sont correctement injectées
