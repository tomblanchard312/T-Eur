# Guide opérationnel 01 : Gel d'urgence d'un portefeuille/compte

## Objectif

Arrêter immédiatement toutes les opérations de transfert sortantes d'une adresse de portefeuille spécifique ou d'un compte d'entité pour empêcher tout mouvement de fonds non autorisé, assurer la conformité réglementaire ou répondre à un incident de sécurité.

## Préconditions

1. L'opérateur doit posséder une clé API ou un JWT avec le rôle `ECB_ADMIN`.
2. La clé utilisée doit être enregistrée dans la hiérarchie des clés souveraines avec le rôle `ISSUING`.
3. L'adresse du portefeuille cible doit être une adresse valide compatible Ethereum (0x...).

## Exigences d'autorisation

- **Gel standard** : Nécessite une autorisation unique d'un responsable opérationnel de la BCE/BCN.
- **Gel de haute valeur (> 1 000 000 €)** : Nécessite une double autorisation (principe des quatre yeux) conformément à la section 4.2 du règlement.

## Étapes d'exécution

### 1. Identifier la cible

Confirmer l'adresse cible et la base légale du gel (ex. : liste de sanctions, alerte à la fraude).

### 2. Exécuter le gel via l'API

Soumettre une requête POST au service de transfert :

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/freeze" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -H "Content-Type: application/json" \
     -d '{
       "account": "0xTargetAddress...",
       "reason": "Conformité aux sanctions d'urgence - ID de dossier : 2026-001"
     }'
```

### 3. Surveiller la confirmation de la blockchain

Attendre que la transaction soit minée sur le réseau Besu. Récupérer le hachage de la transaction à partir de la réponse de l'API.

## Contrôles de validation

1. **Vérification sur la chaîne** :
   Interroger l'état du contrat pour confirmer que l'indicateur `frozen` est défini sur `true` :
   ```bash
   # Utilisation de l'outil CLI interne
   teur-cli query is-frozen 0xTargetAddress...
   ```
2. **Tentative de transfert de test** :
   Tenter un petit transfert à partir du compte gelé. La transaction DOIT échouer avec l'erreur `AccountIsFrozen`.

## Gestion des échecs

- **Transaction annulée** : Si la transaction échoue, vérifier les journaux du `GovernanceService` pour `KEY_VALIDATION_FAILED`. S'assurer que la clé n'a pas été révoquée.
- **Partition réseau** : Si le nœud Besu est injoignable, basculer vers le nœud validateur secondaire dans le plan de règlement fermé (CSP).

## Procédure de retour en arrière / dégel

1. Vérifier la résolution légale du gel.
2. Exécuter la commande de dégel :

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/unfreeze" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -d '{ "account": "0xTargetAddress..." }'
```

## Preuves d'audit produites

- **Journaux API** : Événement `ACCOUNT_FROZEN` au format JSON structuré.
- **Événement Blockchain** : `AccountFrozen(address indexed account)` émis par le contrat `TokenizedEuro`.
- **Journal de gouvernance** : Enregistrement de la clé `ISSUING` utilisée pour l'opération.
