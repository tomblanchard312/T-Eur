# Exercice sur table 01 : Gel d'urgence d'un portefeuille

## Aperçu de l'exercice

### Objectif

Valider la capacité de la BCE à exécuter un gel d'urgence de portefeuille en réponse à une ordonnance juridique de haute priorité, en garantissant le respect des procédures et l'intégrité de l'audit.

### Portée

Cet exercice couvre le processus de bout en bout, de la réception d'une ordonnance juridique à la vérification de l'état de gel sur le registre tEUR.

### Participants et rôles

- **Facilitateur** : Gère le calendrier de l'exercice et les injections.
- **Opérateur BCE** : Exécute la commande technique de gel.
- **Responsable de la conformité** : Valide la base juridique et la justification.
- **Responsable de la sécurité** : Surveille les accès non autorisés ou l'utilisation abusive des clés.
- **Observateur/Auditeur** : Enregistre les actions pour le débriefing.

### Durée

60 minutes.

### Hypothèses

- Le Plan de Règlement Fermé (CSP) est opérationnel.
- L'opérateur BCE possède une clé `ISSUING` valide.
- Le portefeuille cible est actuellement actif sur le registre.

## Chronologie du scénario

### T0 : Conditions initiales

- Statut du système : `ACTIVE`.
- Portefeuille cible : `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`.
- Solde : 1 250,00 €.

### T+05 : Injection 1 - Réception de l'ordonnance juridique

**Injection** : Un courriel urgent de la Cour de justice de l'Union européenne (CJUE) arrive, ordonnant le gel immédiat du portefeuille `0x71C...76F` en raison d'une suspicion de financement du terrorisme (ID de cas : 2026-001).

**Actions attendues des participants** :

- Le responsable de la conformité vérifie l'authenticité de l'ordonnance.
- L'opérateur BCE prépare le Portail de Contrôle Souverain.

### T+15 : Injection 2 - Alerte de haute valeur (Optionnel)

**Injection** : Une alerte de surveillance indique que le portefeuille cible tente de transférer 1 000 000,00 € vers une plateforme d'échange externe.

**Actions attendues des participants** :

- L'opérateur BCE lance immédiatement la commande de gel.
- Le responsable de la conformité fournit la chaîne de justification obligatoire.

**Réponses attendues du système** :

- L'API renvoie `200 OK` avec le hachage de la transaction.
- L'état du registre passe à `frozen: true`.

### T+30 : Injection 3 - Demande de vérification

**Injection** : La CJUE demande la preuve que les fonds sont sécurisés.

**Actions attendues des participants** :

- L'opérateur BCE effectue une requête sur la blockchain pour vérifier le statut.
- Le responsable de la sécurité récupère l'entrée du journal d'audit.

## Points de décision

### Décision 1 : Niveau d'autorisation

- **Question** : Ce gel nécessite-t-il le principe des quatre yeux (double autorisation) ?
- **Options autorisées** :
  - Non, si le solde est inférieur à 1 000 000 €.
  - Oui, si le solde ou la tentative de transaction dépasse 1 000 000 €.
- **Conséquences** : Procéder sans double autorisation pour les comptes de haute valeur entraîne un échec de l'audit procédural.

### Décision 2 : Chaîne de justification

- **Question** : Quelles informations doivent être incluses dans le champ de justification ?
- **Options autorisées** : ID de cas, base juridique et horodatage.
- **Options interdites** : Notes informelles ou champs vides.
- **Conséquences** : Une justification incomplète rend la piste d'audit non conforme aux exigences DORA.

## Critères d'évaluation

- **Exactitude technique** : Le bon portefeuille a-t-il été ciblé et gelé avec succès ?
- **Respect des procédures** : Les rôles ont-ils été respectés (ex: validation par la conformité avant exécution par l'opérateur) ?
- **Exhaustivité de l'audit** : Le journal d'audit contient-il l'ID de cas et la signature de la clé `ISSUING` ?
- **Clarté de la communication** : Les mises à jour de statut étaient-elles claires et concises entre les participants ?

## Liste de contrôle de débriefing

- [ ] L'opérateur a-t-il utilisé le copier-coller pour l'adresse ?
- [ ] La chaîne de justification a-t-elle été saisie correctement ?
- [ ] Le système a-t-il répondu dans les délais de latence attendus ?
- [ ] **Preuves collectées** : Journaux API, événements Blockchain, captures d'écran du portail.
- [ ] **Actions de suivi** : Mettre à jour le runbook si une étape était ambiguë.
