# Flux d'interaction entre l'interface utilisateur de la BCE et le Backend

## 1. Aperçu

Ce document décrit les flux d'interaction de bout en bout entre le **Tableau de bord de l'opérateur de la BCE** (Frontend) et le **Plan de Contrôle du Plan de Règlement Fermé (PRF)** (Backend).

### Limite de confiance

**L'interface utilisateur (UI) n'est pas autoritaire**. Toutes les mesures de sécurité, la validation des rôles (RBAC) et les vérifications de politique sont effectuées par le backend. L'UI sert de couche de présentation sécurisée pour les actions souveraines impliquant une intervention humaine.

---

## 2. Flux 1 : Découverte de l'opérateur et cartographie des capacités

**Objectif** : S'assurer que l'opérateur ne voit que les actions qu'il est autorisé à effectuer.

### Séquence

1. **UI** -> `GET /v1/operator/me` (Authentifié via mTLS)
2. **Le Backend** valide le certificat client et le rôle.
3. **Le Backend** renvoie l'identité, le rôle et les indicateurs de capacité.
4. **L'UI** affiche la barre latérale et les boutons d'action en fonction des `capabilities`.

### Exemple

**Requête** :

```http
GET /v1/operator/me
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000
```

**Réponse (200 OK)** :

```json
{
  "identity": {
    "id": "OP-01",
    "role": "ECB_OPERATOR",
    "cn": "OP-01:ECB_OPERATOR:JohnDoe"
  },
  "capabilities": {
    "canMint": true,
    "canAudit": true,
    "canManageKeys": false
  }
}
```

---

## 3. Flux 2 : Émission de tEUR (Émission souveraine)

**Objectif** : Émettre de nouveaux jetons tEUR dans le schéma.

### Séquence

1. **L'opérateur** saisit le montant et la justification dans l'UI.
2. **L'UI** affiche une **Fenêtre de confirmation** (Obligatoire).
3. **UI** -> `POST /v1/ecb/mint` (Inclut `X-Request-Id` pour l'idempotence).
4. **Le Backend** valide :
   - Le rôle est `ECB_OPERATOR`.
   - La justification est présente et valide.
   - L'émission n'est pas suspendue globalement.
5. **Le Backend** émet les événements d'audit `action_requested` et `action_executed`.
6. **L'UI** affiche un message de succès et la référence d'audit.

### Exemple

**Requête** :

```json
{
  "amount": "100000000",
  "targetAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "justification": "Ajustement trimestriel de la liquidité selon la décision du Conseil 2025/88"
}
```

**Événements d'audit** :

- `MINT_REQUESTED` : Enregistré immédiatement dès réception.
- `MINT_EXECUTED` : Enregistré après confirmation réussie sur la blockchain.

---

## 4. Flux 3 : Destruction de tEUR (Rachat souverain)

**Objectif** : Retirer des jetons tEUR de la circulation.

### Séquence

1. **L'opérateur** saisit le montant et la justification.
2. **L'UI** affiche un **Avertissement d'action irréversible**.
3. **UI** -> `POST /v1/ecb/burn`.
4. **Le Backend** valide le rôle et la justification.
5. **Le Backend** exécute la destruction et émet les événements d'audit.

---

## 5. Flux 4 : Gel d'entité (Application des sanctions)

**Objectif** : Bloquer une adresse de portefeuille spécifique pour l'empêcher d'effectuer des transferts.

### Séquence

1. **L'opérateur** recherche l'adresse dans l'UI.
2. **L'opérateur** saisit la **Base légale** et la justification.
3. **UI** -> `POST /v1/ecb/sanctions/freeze`.
4. **Le Backend** met à jour le registre des sanctions sur la chaîne.
5. **Le Backend** émet l'événement d'audit `SANCTION_FREEZE`.

---

## 6. Flux 5 : Placement sous séquestre

**Objectif** : Bloquer des fonds pour des raisons juridiques ou de conformité.

### Séquence

1. **L'opérateur** saisit l'adresse, le montant et les règles d'expiration.
2. **UI** -> `POST /v1/ecb/escrow/place`.
3. **Le Backend** renvoie un `escrow_id`.
4. **L'UI** affiche le séquestre dans le tableau des "Séquestres actifs".

---

## 7. Flux 6 : Rotation des clés

**Objectif** : Effectuer la rotation des clés souveraines protégées par HSM.

### Séquence

1. **L'opérateur** (Administrateur système) sélectionne la clé dans l'UI.
2. **UI** -> `POST /v1/ecb/keys/rotate`.
3. **Le Backend** déclenche la rotation HSM et renvoie la nouvelle version de la clé.
4. **L'UI** affiche "Rotation réussie" avec l'horodatage.

---

## 8. Flux 7 : Exportation de preuves

**Objectif** : Générer un ensemble signé d'événements d'audit pour les régulateurs.

### Séquence

1. **L'auditeur** applique des filtres (Date, Acteur, Action) dans l'UI.
2. **UI** -> `POST /v1/ecb/audit/export`.
3. **Le Backend** génère une archive ZIP contenant les événements JSON et un manifeste SHA-256.
4. **Le Backend** renvoie une référence de téléchargement.
5. **L'UI** déclenche le téléchargement via le navigateur.

---

## 9. Cas d'échec et réponses d'erreur

| Scénario                    | Code d'erreur       | Statut HTTP | Comportement de l'UI                                      |
| :-------------------------- | :------------------ | :---------- | :-------------------------------------------------------- |
| **Certificat invalide**     | `MTLS_REQUIRED`     | 401         | Redirection vers la page "Accès refusé".                  |
| **Rôle insuffisant**        | `FORBIDDEN`         | 403         | Affichage d'une alerte "Action non autorisée".            |
| **Justification manquante** | `VALIDATION_FAILED` | 400         | Mise en évidence du champ justification en rouge.         |
| **Requête en double**       | `IDEMPOTENCY_HIT`   | 200         | Affichage du résultat précédent (pas de double émission). |
| **Système suspendu**        | `MINTING_SUSPENDED` | 400         | Affichage d'une bannière "Suspension globale active".     |
