# Guide opérationnel 02 : Escalade des sanctions d'urgence

## Objectif

Propager rapidement les restrictions liées aux sanctions sur l'ensemble du réseau tEUR, en veillant à ce que tous les participants (banques, prestataires de services de paiement) bloquent immédiatement les transactions impliquant des entités sanctionnées.

## Préconditions

1. Notification officielle du Conseil européen ou de l'autorité légale compétente.
2. Accès à l'interface de gestion centrale de la BCE au sein du plan de règlement fermé (CSP).

## Règles d'extension du champ d'application

- **Individuel** : Geler des adresses de portefeuille spécifiques.
- **Entité** : Geler tous les portefeuilles associés à un identifiant de participant.
- **Juridictionnel** : (Le cas échéant) Suspendre toutes les opérations pour une zone spécifique.

## Étapes d'exécution

### 1. Exécution du gel par lot

Pour plusieurs adresses, utiliser l'utilitaire de traitement par lot pour minimiser la latence :

```bash
# Script interne pour les sanctions par lot
node api/bin/batch-freeze.js --file sanctions-list-2026-01-03.json
```

### 2. Mettre à jour le miroir des sanctions locales

Mettre à jour le service interne `ecb-mirror` pour s'assurer que la passerelle API rejette les transactions à la périphérie avant qu'elles n'atteignent la blockchain :

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/sanctions/sync" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

### 3. Diffuser le manifeste des sanctions

Le système génère automatiquement un nouveau `ecb-manifest` contenant les comptes gelés mis à jour. Ce manifeste est récupéré par tous les nœuds participants dans les 60 secondes.

## Garanties de propagation

- **État de la blockchain** : Une fois la transaction de `freeze` confirmée, la restriction est absolue et appliquée par chaque nœud du réseau.
- **Latence** : Le délai de propagation maximal est défini comme `Temps de bloc (2s) + Temps de synchronisation (5s) = 7s`.

## Garanties de visibilité pour les régulateurs

- Les régulateurs ont un accès en lecture seule aux événements du contrat `TokenizedEuro`.
- L' `AuditService` fournit un flux en temps réel des événements `ACCOUNT_FROZEN` via le point de terminaison `/api/v1/audit/stream`.

## Enregistrement de la référence légale

Chaque opération de gel DOIT inclure un champ `reason` contenant :

- Référence de l'instrument juridique (ex. : règlement UE 2024/XXX).
- ID de dossier.
- Horodatage de l'ordonnance légale.

## Contrôles de validation

- Vérifier que le hachage de `ecb-manifest` a été mis à jour et signé par la clé `ISSUING`.
- Confirmer que les nœuds participants ont accusé réception de la mise à jour du manifeste.

## Artefacts d'audit générés

- `ecb-manifest.json` signé.
- Entrées `logAuditEvent` avec `action: 'SANCTIONS_ESCALATION'`.
- Reçus de transaction blockchain pour toutes les adresses gelées.
