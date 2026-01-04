# Manuel Opérationnel 06 : Communication et Preuves

## Objectif

Standardiser la collecte, la préservation et le signalement des preuves pendant et après une opération monétaire d'urgence, afin de garantir la défendabilité juridique et la transparence réglementaire.

## Preuves Collectées Automatiquement

### 1. Journaux d'Audit de l'API

L'`AuditService` capture chaque requête vers l'espace de noms `/api/v1`, y compris :

- `X-Request-Id` (Corrélation).
- `X-API-KEY` (Identification de l'acteur - masquée).
- Charge utile de la requête et statut de la réponse.
- Horodatage (UTC).

### 2. Journaux de Gouvernance

Le `GovernanceService` enregistre :

- Les résultats de validation des rôles de clés.
- Les motifs de révocation.
- Les chemins de traversée de la hiérarchie.

### 3. État de la Blockchain

Le réseau Besu fournit un enregistrement immuable de :

- Hachages de transaction.
- Événements émis (`Transfer`, `AccountFrozen`, `Paused`).
- En-têtes de blocs et horodatages.

## Preuves Devant Être Préservées Manuellement

### 1. Documents d'Autorisation

- PDF signés ou documents physiques du Conseil des Gouverneurs de la BCE autorisant l'action d'urgence.
- E-mails ou messages sécurisés initiant la réponse à l'incident.

### 2. Renseignement Externe

- Captures d'écran ou exports de fournisseurs de sanctions externes (ex: ONU, OFAC).
- Rapports de fraude provenant de banques commerciales.

### 3. Chronologie de l'Incident

- Un journal manuel de toutes les décisions verbales et actions hors système prises pendant l'"Heure d'Or" de l'incident.

## Artefacts Conservés pour l'Audit

Tous les artefacts doivent être conservés pendant au moins 10 ans, conformément aux exigences DORA/ISO 27001 :

- **Journaux JSONL** : Exports quotidiens des journaux de l'`AuditService`.
- **Instantanés du Manifeste** : Le fichier `ecb-manifest.json` au moment de l'incident.
- **Sauvegardes de la Base de Données** : Instantanés chiffrés de l'état interne de la passerelle API.

## Protocole de Communication

1. **Interne** : Notification immédiate au CISO de la BCE et au Responsable de l'Infrastructure de Marché.
2. **Participants** : Diffusion via les types d'événements `SYSTEM_PAUSED` ou `SECURITY_ALERT`.
3. **Régulateurs** : Rapport formel soumis via le Portail Réglementaire Sécurisé sous 24 heures.
4. **Public** : (Si requis) Déclaration officielle via le site web de la BCE. Aucun détail technique (clés, adresses) ne doit être partagé publiquement.

## Contrôles de Validation

- Confirmez que le `logAuditEvent` pour l'action d'urgence contient un `correlationId` valide.
- Vérifiez que le paquet de preuves est haché cryptographiquement et que le hachage est enregistré dans l'`AuditService`.

## Artefacts d'Audit Générés

- Événement de journal `SECURITY_ALERT`.
- `MANIFEST_DIAGNOSTICS_WRITTEN` (si des problèmes d'intégrité ont été détectés).
- Rapport final de synthèse de l'incident.
