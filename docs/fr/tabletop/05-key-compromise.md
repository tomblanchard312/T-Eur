# Exercice sur table 05 : Réponse d'urgence à la compromission de clé

## Aperçu de l'exercice

### Objectif

Tester la réponse de la BCE à la compromission d'une clé souveraine ou de participant, en se concentrant sur la révocation, l'isolation et la récupération.

### Portée

Révocation d'une clé `PARTICIPANT` compromise, suspension de la banque affectée et émission d'une clé de remplacement.

### Participants et rôles

- **Facilitateur** : Gère le flux de l'incident de sécurité.
- **Responsable sécurité** : Détecte et confirme la compromission.
- **Admin BCE** : Exécute la révocation et le changement de clé.
- **Liaison participant** : Coordonne avec le CISO de la banque affectée.

### Durée

90 minutes.

### Hypothèses

- La clé `ROOT` ou `ISSUING` est sécurisée.
- La compromission est limitée à l'environnement opérationnel d'un seul participant.

## Chronologie du scénario

### T0 : Conditions initiales

- Participant : Banque X.
- Clé active : `bank-x-p-1`.
- Statut : `ACTIVE`.

### T+10 : Injection 1 - Alerte de compromission

**Injection** : Un rapport de renseignement confirme que la clé privée de `bank-x-p-1` a été publiée sur un forum du dark web.

**Actions attendues des participants** :

- Le responsable sécurité vérifie l'ID de la clé.
- L'admin BCE prépare l'interface de révocation.

### T+20 : Injection 2 - Activité non autorisée

**Injection** : Le registre montre une série de transferts inhabituels de haute valeur provenant du portefeuille opérationnel de la Banque X utilisant la clé compromise.

**Actions attendues des participants** :

- L'admin BCE exécute immédiatement la commande `REVOKE` pour `bank-x-p-1`.
- La liaison participant informe la Banque X de fermer sa passerelle.

**Réponses attendues du système** :

- Le `GovernanceService` rejette toute nouvelle demande de `bank-x-p-1`.
- Le journal d'audit enregistre `KEY_REVOKED`.

### T+50 : Injection 3 - Récupération et changement de clé

**Injection** : La Banque X confirme que son environnement est désormais sécurisé et demande une nouvelle clé pour reprendre ses opérations.

**Actions attendues des participants** :

- L'admin BCE génère et enregistre `bank-x-p-2`.
- Le responsable sécurité vérifie les métadonnées de la nouvelle clé.

## Points de décision

### Décision 1 : Révocation immédiate vs Observation

- **Question** : La clé doit-elle être révoquée immédiatement ou surveillée pour identifier l'attaquant ?
- **Options autorisées** : Révocation immédiate.
- **Options interdites** : Surveillance (interdite dans les protocoles d'urgence de compromission de clé).
- **Conséquences** : Retarder la révocation permet à l'attaquant de vider les fonds ou de perturber le réseau.

### Décision 2 : Suspension du participant

- **Question** : La Banque X doit-elle être suspendue entièrement ou seulement la clé compromise ?
- **Options autorisées** : Suspendre le participant jusqu'à ce qu'un audit de sécurité complet soit terminé.
- **Conséquences** : Révoquer uniquement la clé peut laisser d'autres vulnérabilités (ex: clés secondaires) exposées.

## Critères d'évaluation

- **Exactitude technique** : Révocation réussie du bon ID de clé.
- **Respect des procédures** : Action immédiate entreprise dès confirmation de la compromission.
- **Exhaustivité de l'audit** : Événements `KEY_REVOKED` et `KEY_REGISTERED` journalisés.
- **Clarté de la communication** : Instructions claires fournies au participant affecté.

## Liste de contrôle de débriefing

- [ ] Le bon `keyId` a-t-il été révoqué ?
- [ ] Le `GovernanceService` a-t-il réussi à bloquer les transferts non autorisés ?
- [ ] La clé de remplacement a-t-elle été émise en suivant le processus d'enregistrement standard ?
- [ ] **Preuves collectées** : Journaux de révocation, reçu d'enregistrement de la nouvelle clé.
- [ ] **Actions de suivi** : Réviser la sécurité physique des HSM des participants.
