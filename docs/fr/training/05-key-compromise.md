# Scénario de formation 05 : Réponse d'urgence à la compromission de clé

## Titre du scénario

Confinement et récupération après une compromission de clé.

## Objectifs d'apprentissage

- Révoquer une clé compromise dans la hiérarchie souveraine.
- Isoler un participant affecté.
- Enregistrer une clé de remplacement.

## Préconditions

- L'opérateur a le rôle `ECB_ADMIN`.
- Clé `ROOT` ou `ISSUING` valide.

## État initial du système

- Le participant "Banque X" possède une clé `PARTICIPANT` active `bank-x-p-1`.
- Le système est `ACTIVE`.

## Événement déclencheur

Les services de renseignement de sécurité confirment que la clé privée de `bank-x-p-1` a été exfiltrée.

## Actions étape par étape

1. **Révocation** : Localiser `bank-x-p-1` dans l'interface de sécurité et cliquer sur "RÉVOQUER".
2. **Justification** : Saisir "Compromission de clé confirmée - Incident #2026-05".
3. **Isolation** : Désactiver le participant "Banque X" dans l'interface de gestion des participants.
4. **Remplacement** : Générer et enregistrer une nouvelle clé `bank-x-p-2` pour le participant.
5. **Vérification** : Tenter d'utiliser l'ancienne clé et confirmer qu'elle est rejetée avec `KEY_REVOKED`.

## Réponses attendues du système

- Le `GovernanceService` met à jour le statut de la clé en `REVOKED`.
- Toutes les demandes signées par l'ancienne clé sont immédiatement bloquées.
- Le journal d'audit enregistre `KEY_REVOKED`.

## Erreurs courantes à éviter

- Révoquer la mauvaise clé (vérifier l'ID de la clé deux fois).
- Ne pas isoler le participant, lui permettant d'utiliser des clés secondaires si elles existent.
- Retarder la révocation pour "enquêter" (la révocation doit être immédiate).

## Artefacts d'audit produits

- Événement de journal `KEY_REVOKED`.
- Événement de journal `KEY_REGISTERED` pour la nouvelle clé.
- Capture d'écran mise à jour de la hiérarchie de gouvernance.

## Critères d'achèvement

La clé compromise est révoquée avec succès, le participant est isolé et une nouvelle clé sécurisée est enregistrée.
