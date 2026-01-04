# Preuve d'audit : Non-contournement de l'UI et autorité du Backend

## 1. Introduction

Ce document fournit des preuves vérifiables que **l'interface opérateur de la BCE tEUR** est une couche de présentation non autoritaire. Toute l'autorité souveraine, l'application de la sécurité et la validation des politiques résident exclusivement dans le backend du **Plan de Règlement Fermé (PRF)**.

## 2. Preuve 1 : Application du RBAC (Autorité du Backend)

**Contrôle** : Le backend valide le rôle lié au certificat mTLS pour chaque requête, quel que soit l'état de l'interface utilisateur (UI).

### Cas de test : Accès à un point de terminaison non autorisé

- **Acteur** : Auditeur (Rôle : `AUDITOR`)
- **Action** : Appel API direct vers `/v1/ecb/mint` (en contournant l'UI)
- **Commande** :
  ```bash
  curl -X POST https://csp.teur.internal/v1/ecb/mint \
    --cert auditor.crt --key auditor.key \
    -H "Content-Type: application/json" \
    -d '{"amount": "1000", "justification": "Tentative non autorisée"}'
  ```
- **Résultat attendu** :
  - **Statut HTTP** : `403 Forbidden`
  - **Code d'erreur** : `RBAC_FAILURE`
  - **Événement d'audit** : `action_rejected` émis avec l'acteur `AUD001` et la raison `Permissions insuffisantes`.

---

## 3. Preuve 2 : Intégrité de la liaison Rôle-mTLS

**Contrôle** : Le backend rejette les requêtes où l'identité du certificat ne correspond pas au rôle requis pour l'action demandée.

### Cas de test : Incohérence de rôle

- **Scénario** : Un certificat valide pour un `PARTICIPANT` est utilisé pour appeler un point de terminaison réservé à un `ECB_OPERATOR`.
- **Résultat attendu** :
  - **Statut HTTP** : `403 Forbidden`
  - **Code d'erreur** : `UNAUTHORIZED_ROLE`
  - **Preuve** : Les journaux du backend affichent : `Le rôle PARTICIPANT n'est pas reconnu dans le PRF pour le chemin /v1/ecb/mint`.

---

## 4. Preuve 3 : Justification obligatoire et politique

**Contrôle** : Le backend impose la présence d'une chaîne de justification pour toutes les actions souveraines.

### Cas de test : Justification manquante

- **Action** : L'opérateur de la BCE appelle `/v1/ecb/mint` sans le champ `justification`.
- **Résultat attendu** :
  - **Statut HTTP** : `400 Bad Request`
  - **Code d'erreur** : `VALIDATION_FAILED`
  - **Détails** : `path: justification, message: Required`
  - **Événement d'audit** : Aucun événement `action_executed` n'est émis ; la transaction n'est jamais envoyée à la blockchain.

---

## 5. Preuve 4 : Rendu de l'UI non autoritaire

**Contrôle** : L'UI affiche les actions en fonction de la réponse de `/v1/operator/me`, mais le backend reste le validateur final.

### Collecte de preuves

1. **Étape** : Modifier le DOM du navigateur pour afficher le bouton "Émettre" (Mint) pour un auditeur.
2. **Étape** : Cliquer sur le bouton et soumettre une requête.
3. **Résultat** : Le backend renvoie `403 Forbidden`.
4. **Conclusion** : La visibilité de l'UI est une fonctionnalité d'ergonomie ; l'application par le backend est la frontière de sécurité.

---

## 6. Preuve 5 : Complétude des événements d'audit et corrélation

**Contrôle** : Chaque action souveraine est liée à travers le système via un identifiant de corrélation unique.

### Artefact de preuve

| Artefact               | Emplacement  | Valeur                                              |
| :--------------------- | :----------- | :-------------------------------------------------- |
| **En-tête de requête** | Sortie UI    | `X-Correlation-Id: 550e...`                         |
| **Journal Backend**    | Service PRF  | `Traitement MINT pour Correlation-Id: 550e...`      |
| **Magasin d'audit**    | Base d'audit | `Événement: MINT_EXECUTED, Correlation-Id: 550e...` |

---

## 7. Preuve 6 : Intégrité de l'ensemble de preuves

**Contrôle** : Les ensembles de preuves exportés sont protégés par un manifeste cryptographique.

### Étapes de validation

1. **Exportation** : Générer l'ensemble via `POST /v1/ecb/audit/export`.
2. **Inspection** : Ouvrir `evidence_20260103.zip`.
3. **Vérification** :
   - `manifest.json` contient les empreintes SHA-256 de tous les journaux d'audit inclus.
   - `signature.asc` fournit la preuve d'origine du module de sécurité du PRF.
4. **Commande** :
   ```bash
   sha256sum -c manifest.json
   ```
   **Résultat attendu** : `audit_log_01.json: OK`

---

## 8. Conclusion

Ces preuves démontrent que le système tEUR suit le **principe du moindre privilège** et la **défense en profondeur**. L'UI ne peut pas être utilisée pour contourner les contrôles monétaires et de sécurité rigoureux appliqués par la BCE au sein du Plan de Règlement Fermé.
