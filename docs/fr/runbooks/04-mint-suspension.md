# Guide opérationnel 04 : Suspension d'émission d'urgence

## Objectif

Suspendre globalement la création de nouveaux jetons tEUR pour protéger l'intégrité monétaire du système lors d'une faille de sécurité majeure, de la découverte d'une vulnérabilité de contrat intelligent ou d'une instabilité extrême du marché.

## Préconditions

1. Détection d'une émission non autorisée ou d'un écart de l'offre totale.
2. Autorisation du Conseil des gouverneurs de la BCE (ou du comité d'urgence délégué).
3. Possession de la clé `ISSUING` de la BCE.

## Étapes d'exécution

### 1. Exécution de la pause globale

Appeler le point de terminaison de pause du système. Ceci utilise le modèle `Pausable` dans le contrat `TokenizedEuro`.

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/system/pause" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

### 2. Vérifier l'état global

Confirmer que l'état `paused()` sur la blockchain est `true`.

```bash
teur-cli query is-paused
```

### 3. Informer les participants

Le système diffuse automatiquement une alerte `SYSTEM_PAUSED` à toutes les banques et prestataires de services de paiement connectés via la couche de messagerie sécurisée.

## Impact sur le règlement et la réconciliation

- **Règlement** : Tous les nouveaux transferts échoueront. Les transactions en attente dans le mempool seront rejetées.
- **Réconciliation** : Le service `ecb-ingest` continuera de suivre le dernier état valide connu. Aucun nouveau changement d'offre ne sera enregistré.
- **Paiements hors ligne** : Les limites hors ligne restent actives mais ne peuvent pas être reconstituées tant que le système n'est pas remis en service.

## Comment reprendre l'émission en toute sécurité

1. **Analyse de la cause profonde** : Confirmer que la vulnérabilité est corrigée ou que la menace est neutralisée.
2. **Vérification de l'intégrité de l'état** : Exécuter l'outil `reconciliation-ref` pour s'assurer que l'offre sur la chaîne correspond au grand livre de la BCE.
3. **Reprise (Unpause)** :

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/system/unpause" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

## Gestion des échecs

- Si la clé `ISSUING` est compromise, utiliser d'abord la clé `Root` pour révoquer la clé `ISSUING` (voir le guide opérationnel 05), puis utiliser une clé `ISSUING` secondaire pour mettre en pause.

## Artefacts d'audit générés

- Événements de journal `SYSTEM_PAUSED` / `SYSTEM_UNPAUSED`.
- Événements `Paused` / `Unpaused` de la blockchain.
- Blob d'autorisation signé stocké dans l' `AuditService`.
