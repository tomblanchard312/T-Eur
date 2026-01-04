# Manuel Opérationnel 05 : Réponse d'Urgence à la Compromission de Clé

## Objectif

Détecter, contenir et remédier à la compromission d'une clé cryptographique au sein de la Hiérarchie des Clés Souveraines, afin d'empêcher toute action monétaire non autorisée.

## Déclencheurs de Détection

- **Action Non Autorisée** : Un événement `TOKENS_MINTED` ou `SYSTEM_PAUSED` non lié à une demande de changement interne valide.
- **Alerte de Gouvernance** : Pics de `KEY_VALIDATION_FAILED` dans les journaux.
- **Violation Physique** : Compromission signalée d'un HSM ou d'une enclave sécurisée.

## Actions de Confinement Immédiat

### 1. Révoquer la Clé Compromise

Révoquez immédiatement la clé en utilisant la clé `ISSUING` ou `ROOT` :

```bash
curl -X POST "https://[internal-gateway]/api/v1/governance/keys/[COMPROMISED_KEY_ID]/revoke" \
     -H "X-API-KEY: [ROOT_OR_ISSUING_KEY]" \
     -d '{ "reason": "Confirmed Key Compromise - Incident #2026-05" }'
```

### 2. Pause Globale (Si la clé était ISSUING/OPERATIONAL)

Si la clé compromise avait des pouvoirs de frappe ou d'administration, exécutez immédiatement le Manuel Opérationnel 04 (Suspension d'Urgence de la Frappe).

## Isolation des Participants

- Si la clé d'un Participant (Banque) est compromise, la BCE révoquera toutes les clés associées à cet `ownerId`.
- L'accès à la passerelle du Participant est bloqué au niveau du pare-feu dans le CSP.

## Étapes de Récupération du Système

### 1. Rotation des Clés

Générez de nouvelles clés pour l'entité affectée et enregistrez-les via le `GovernanceService`.

```bash
curl -X POST "https://[internal-gateway]/api/v1/governance/keys" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -d '{
       "keyId": "new-bank-key-01",
       "publicKey": "0xNewPubKey...",
       "role": "PARTICIPANT",
       "ownerId": "bank-de-01"
     }'
```

### 2. Examen de la Piste d'Audit

Examinez toutes les transactions signées par la clé compromise depuis l'heure estimée de la compromission. Identifiez toute transaction "empoisonnée" pour inversion ou mise sous séquestre.

### 3. Restauration du Service

Une fois l'environnement vérifié comme propre, réactivez le système (s'il était en pause).

## Contrôles de Validation

- Confirmez que le `keyId` compromis renvoie `status: 'REVOKED'` dans le `GovernanceService`.
- Vérifiez que toute tentative d'utilisation de l'ancienne clé entraîne un `403 Forbidden` immédiat avec un événement de journal `KEY_REVOKED`.

## Artefacts d'Audit Générés

- Événement de journal `KEY_REVOKED`.
- Événement de journal `KEY_REGISTERED` pour le remplacement.
- Rapport d'incident contenant la chronologie de la détection et de la révocation.
