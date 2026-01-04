# Scénario de formation 04 : Suspension d'urgence de la frappe

## Titre du scénario

Suspension globale des opérations monétaires.

## Objectifs d'apprentissage

- Exécuter une pause globale du système.
- Comprendre l'impact sur le règlement et les participants.
- Effectuer la procédure de reprise en toute sécurité.

## Préconditions

- L'opérateur a le rôle `ECB_ADMIN`.
- Clé `ISSUING` valide.

## État initial du système

- Le statut du système est `ACTIVE`.
- La masse monétaire totale est de 1 250 000 000,00 €.

## Événement déclencheur

Détection d'une vulnérabilité critique dans un contrat intelligent permettant une frappe non autorisée. Une suspension immédiate est requise pour protéger la souveraineté monétaire.

## Actions étape par étape

1. **Pause d'urgence** : Naviguer vers l'interface d'administration système et cliquer sur "PAUSE GLOBALE".
2. **Justification** : Saisir "Atténuation de vulnérabilité critique - Incident #2026-04".
3. **Vérification** : Confirmer `isPaused() == true` via le tableau de bord.
4. **Notification des participants** : Vérifier que l'alerte `SYSTEM_PAUSED` a été diffusée.
5. **Reprise (simulée)** : Une fois le "correctif" appliqué, exécuter la commande "REPRISE GLOBALE".

## Réponses attendues du système

- Toutes les nouvelles demandes de transfert et de frappe sont rejetées avec `SYSTEM_PAUSED`.
- L'état `paused` de la blockchain est défini sur `true`.
- Le journal d'audit enregistre `SYSTEM_PAUSED`.

## Erreurs courantes à éviter

- Hésiter à mettre en pause en attendant une confirmation secondaire (les protocoles d'urgence privilégient le confinement).
- Ne pas vérifier la pause sur la blockchain.
- Reprendre avant qu'un contrôle complet de l'intégrité de la réconciliation ne soit terminé.

## Artefacts d'audit produits

- Événement de journal `SYSTEM_PAUSED`.
- Événement blockchain `Paused`.
- Blob d'autorisation signé dans le service d'audit.

## Critères d'achèvement

Le système est mis en pause avec succès, toutes les opérations monétaires sont interrompues, et le système est repris en toute sécurité après le correctif simulé.
