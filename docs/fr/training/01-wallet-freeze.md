# Scénario de formation 01 : Gel d'urgence d'un portefeuille

## Titre du scénario

Exécution du gel d'urgence d'un portefeuille pour conformité aux sanctions.

## Objectifs d'apprentissage

- Identifier correctement l'adresse du portefeuille cible.
- Exécuter la commande de gel via le Portail de Contrôle Souverain ou l'API.
- Vérifier l'état de gel sur la blockchain.
- Comprendre la piste d'audit générée par l'action.

## Préconditions

- L'opérateur a le rôle `ECB_ADMIN`.
- L'opérateur possède une clé `ISSUING` valide.
- L'accès au Plan de Règlement Fermé (CSP) est établi.

## État initial du système

- Le portefeuille cible `0x71C7656EC7ab88b098defB751B7401B5f6d8976F` est actif.
- Le solde est de 1 250,00 €.
- Le statut du système est `ACTIVE`.

## Événement déclencheur

Réception d'une ordonnance juridique officielle (ID de cas : 2026-001) exigeant le gel immédiat du portefeuille cible en raison de son inscription sur une liste de sanctions.

## Actions étape par étape

1. **Authentification** : Se connecter au Portail de Contrôle Souverain en utilisant le mTLS et la clé `ISSUING`.
2. **Identification** : Saisir l'adresse cible `0x71C7656EC7ab88b098defB751B7401B5f6d8976F` dans l'interface utilisateur des sanctions.
3. **Justification** : Saisir la justification obligatoire : "Conformité aux sanctions d'urgence - ID de cas : 2026-001".
4. **Exécution** : Cliquer sur "Geler le compte" et confirmer l'action dans le modal de sécurité.
5. **Vérification** : Interroger le statut du compte pour confirmer `frozen: true`.

## Réponses attendues du système

- L'API renvoie `200 OK` avec un hachage de transaction.
- La blockchain émet l'événement `AccountFrozen`.
- Le journal d'audit enregistre l'événement `ACCOUNT_FROZEN`.

## Erreurs courantes à éviter

- Saisir une mauvaise adresse de portefeuille (toujours utiliser le copier-coller).
- Oublier d'inclure la référence juridique dans la justification.
- Ne pas vérifier le changement d'état après l'exécution.

## Artefacts d'audit produits

- Entrée de journal `ACCOUNT_FROZEN` dans le service d'audit.
- Reçu de transaction blockchain.
- Entrée signée dans le service de gouvernance liant l'action à la clé `ISSUING`.

## Critères d'achèvement

Le portefeuille cible est gelé avec succès, et l'action est vérifiée à la fois via l'interface utilisateur et par une requête directe sur la blockchain.
