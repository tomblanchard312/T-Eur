# Scénario de formation 03 : Placement en séquestre d'urgence

## Titre du scénario

Isolation de fonds litigieux via un séquestre.

## Objectifs d'apprentissage

- Différencier un gel complet d'un placement en séquestre.
- Exécuter la commande de séquestre pour un montant spécifique.
- Vérifier le solde restreint sur le compte cible.

## Préconditions

- L'opérateur a le rôle `ECB_ADMIN` ou `NCB_OPERATOR`.
- Clé `OPERATIONAL` valide.

## État initial du système

- Le compte cible `0xABC...` a un solde de 10 000,00 €.
- Aucun séquestre actif sur le compte.

## Événement déclencheur

Une banque commerciale signale une transaction suspecte de 5 000,00 €. Les fonds doivent être isolés en attendant une enquête de 48 heures.

## Actions étape par étape

1. **Identification** : Localiser le compte cible dans l'interface utilisateur de séquestre.
2. **Saisie des paramètres** : Saisir le montant `500000` (centimes d'euro) et le motif "Enquête pour fraude en cours - Cas #998".
3. **Réglage de l'expiration** : Régler l'horodatage `expiresAt` à 48 heures à partir de l'heure actuelle.
4. **Exécution** : Cliquer sur "Placer en séquestre" et confirmer.
5. **Vérification** : Vérifier le solde disponible du compte (devrait être de 5 000,00 €) et le solde sous séquestre (devrait être de 5 000,00 €).

## Réponses attendues du système

- L'API renvoie `201 Created` avec un `escrowId`.
- La blockchain émet l'événement `FundsEscrowed`.
- Le solde disponible est immédiatement réduit.

## Erreurs courantes à éviter

- Saisir le montant en euros au lieu de centimes (ex: saisir 5000 au lieu de 500000).
- Configurer une expiration de libération automatique (interdit pour les séquestres d'urgence).
- Confondre l'adresse `from` avec l'adresse `payee`.

## Artefacts d'audit produits

- Événement de journal `FUNDS_ESCROWED`.
- Reçu de transaction blockchain.
- Entrée dans la file d'attente de révision manuelle pour le responsable de la conformité.

## Critères d'achèvement

Le montant spécifié est déplacé avec succès vers le contrat de séquestre, et le solde disponible du compte est correctement restreint.
