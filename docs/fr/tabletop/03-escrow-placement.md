# Exercice sur table 03 : Placement en séquestre d'urgence

## Aperçu de l'exercice

### Objectif

Valider la procédure d'isolation des fonds litigieux à l'aide du mécanisme de séquestre tEUR, en garantissant que les fonds sont restreints sans gel complet du compte.

### Portée

Placement de fonds spécifiques sous séquestre, gestion des horodatages d'expiration et vérification des soldes restreints.

### Participants et rôles

- **Facilitateur** : Gère les injections.
- **Opérateur BCN** : Initie la demande de séquestre.
- **Conformité BCE** : Approuve les paramètres du séquestre.
- **Liaison banque commerciale** : Communique avec la banque déclarante.

### Durée

45 minutes.

### Hypothèses

- Le compte cible dispose d'un solde suffisant.
- La clé `OPERATIONAL` est disponible pour l'opérateur BCN.

## Chronologie du scénario

### T0 : Conditions initiales

- Compte cible : `0xABC...123`.
- Solde : 10 000,00 €.
- Statut : `ACTIVE`.

### T+05 : Injection 1 - Rapport de fraude

**Injection** : Une banque commerciale signale qu'un transfert de 5 000,00 € vers `0xABC...123` n'était pas autorisé. Elle demande que les fonds soient bloqués pendant 48 heures.

**Actions attendues des participants** :

- La liaison banque commerciale confirme les détails de la transaction.
- L'opérateur BCN prépare l'interface de séquestre.

### T+15 : Injection 2 - Conflit de paramètres

**Injection** : La banque déclarante demande un blocage indéfini, mais le règlement tEUR limite les séquestres d'urgence à 72 heures sans ordonnance du tribunal.

**Actions attendues des participants** :

- La conformité BCE applique la limite de 72 heures.
- L'opérateur BCN règle `expiresAt` à T+48 heures.

### T+25 : Injection 3 - Exécution et vérification

**Injection** : Le séquestre est exécuté. Le titulaire du compte tente de dépenser la totalité des 10 000,00 €.

**Actions attendues des participants** :

- L'opérateur BCN vérifie l'échec de la transaction pour le montant restreint.
- La conformité BCE vérifie le journal d'audit `FUNDS_ESCROWED`.

## Points de décision

### Décision 1 : Séquestre vs Gel

- **Question** : Pourquoi utiliser le séquestre plutôt qu'un gel complet ?
- **Options autorisées** : Pour permettre au titulaire du compte de continuer à utiliser les fonds non litigieux (5 000,00 €).
- **Options interdites** : Geler l'intégralité du compte pour un litige partiel.
- **Conséquences** : Un gel inutile de l'ensemble du compte peut entraîner une responsabilité juridique pour la BCE.

### Décision 2 : Gestion de l'expiration

- **Question** : Que se passe-t-il si les 48 heures expirent sans résolution ?
- **Options autorisées** : Les fonds sont automatiquement libérés à moins qu'une extension manuelle ou un gel ne soit appliqué.
- **Conséquences** : Le défaut de surveillance de l'expiration peut entraîner la perte des fonds litigieux.

## Critères d'évaluation

- **Exactitude technique** : Montant et expiration corrects définis dans la commande de séquestre.
- **Respect des procédures** : Respect de la limite de 72 heures du règlement.
- **Exhaustivité de l'audit** : Vérification de l'ID de séquestre et de l'événement blockchain.
- **Clarté de la communication** : Explication claire à la banque déclarante concernant la durée du blocage.

## Liste de contrôle de débriefing

- [ ] Le montant a-t-il été saisi en centimes (500000) ?
- [ ] L'horodatage `expiresAt` a-t-il été calculé correctement ?
- [ ] Le transfert partiel du titulaire du compte a-t-il réussi comme prévu ?
- [ ] **Preuves collectées** : Événement `FundsEscrowed`, réponse API.
- [ ] **Actions de suivi** : Réviser le système de notification automatisé pour les séquestres arrivant à expiration.
