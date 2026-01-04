# Guide opérationnel 03 : Placement sous séquestre d'urgence

## Objectif

Isoler les fonds contestés ou suspects en les déplaçant vers un compte séquestre contrôlé par le système. Ceci est utilisé lorsqu'un gel complet du compte est jugé disproportionné ou lorsque les fonds doivent être conservés en attendant une décision judiciaire.

## Quand le séquestre est utilisé à la place du gel

- **Transactions contestées** : Lorsqu'un transfert est signalé comme potentiellement frauduleux mais que le titulaire du compte n'est pas encore vérifié comme étant un acteur malveillant.
- **Opérations de récupération (Clawback)** : Détention temporaire de fonds pendant un processus d'annulation.
- **Ordonnances judiciaires** : Exigences spécifiques de mise de côté d'un montant fixe tout en permettant au compte de rester opérationnel pour d'autres fonds.

## Étapes d'exécution

### 1. Calculer le montant du séquestre

Déterminer le montant exact en centimes d'euro (2 décimales) à déplacer.

### 2. Exécuter le séquestre via l'API

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/escrow" \
     -H "X-API-KEY: [OPERATIONAL_KEY]" \
     -d '{
       "from": "0xSourceAddress...",
       "amount": 500000,
       "reason": "Enquête pour fraude en cours - Dossier #998",
       "expiresAt": 1735948800
     }'
```

### 3. Vérifier le mouvement

Confirmer que le solde source a diminué et que le solde du contrat `Escrow` pour cet `escrowId` a augmenté.

## Opérations bloquées

- **Compte source** : Ne peut pas transférer la partie du solde mise sous séquestre.
- **Fonds sous séquestre** : Ne peuvent être détruits, transférés ou utilisés pour des paiements par aucune partie, à l'exception de la BCE/BCN.

## Gestion de l'expiration

- Si `expiresAt` est atteint sans intervention manuelle, les fonds restent sous séquestre mais déclenchent une alerte `MANUAL_REVIEW_REQUIRED` dans l' `AuditService`.
- La libération automatique est INTERDITE pour les séquestres d'urgence.

## Exigences de révision manuelle

- Audit hebdomadaire de tous les séquestres actifs par le responsable de la conformité.
- La justification de la prolongation doit être enregistrée dans l' `AuditService`.

## Contrôles de validation

- Vérifier `getEscrowBalance(escrowId)` sur la chaîne.
- Vérifier l'événement `FUNDS_ESCROWED` dans les journaux de l'API.

## Artefacts d'audit générés

- Événement de journal `FUNDS_ESCROWED`.
- Événement `Transfer` de la blockchain vers l'adresse du contrat de séquestre.
- Entrée dans la piste d'audit du `GovernanceService` liant l'action à la clé `OPERATIONAL`.
