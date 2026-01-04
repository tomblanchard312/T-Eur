# Exercice sur table 04 : Suspension d'urgence de la frappe

## Aperçu de l'exercice

### Objectif

Exercer la capacité globale de "bouton d'arrêt" (Kill Switch) pour suspendre toutes les opérations monétaires (frappe et transferts) en réponse à une menace systémique.

### Portée

Activation de la pause globale, communication avec l'Eurosystème et reprise contrôlée des opérations.

### Participants et rôles

- **Facilitateur** : Dirige le scénario de crise.
- **Exécutif BCE** : Autorise la pause globale.
- **Admin BCE** : Exécute la commande technique de pause.
- **Responsable communication** : Gère la diffusion à tous les participants.
- **Responsable technique** : Coordonne l'évaluation de la vulnérabilité.

### Durée

120 minutes.

### Hypothèses

- Une vulnérabilité critique a été identifiée.
- La clé `ISSUING` est sécurisée et disponible.

## Chronologie du scénario

### T0 : Conditions initiales

- Statut du système : `ACTIVE`.
- Charge réseau : Élevée.

### T+10 : Injection 1 - Détection de vulnérabilité

**Injection** : Le centre d'opérations de sécurité (SOC) détecte une exploitation dans la fonction `mint` qui permet de contourner la vérification des données de référence de la BCE. Des tEUR non autorisés sont générés.

**Actions attendues des participants** :

- Le responsable technique confirme l'exploitation.
- L'exécutif BCE convoque l'équipe de gestion de crise.

### T+20 : Injection 2 - Exécution de la pause

**Injection** : L'exécutif BCE autorise une pause globale.

**Actions attendues des participants** :

- L'admin BCE exécute la commande `GLOBAL PAUSE`.
- Le responsable communication diffuse l'alerte `SYSTEM_PAUSED`.

**Réponses attendues du système** :

- Toutes les transactions en attente sont rejetées.
- `isPaused()` renvoie `true`.

### T+60 : Injection 3 - Pression pour la reprise

**Injection** : Les principales banques commerciales signalent que la pause perturbe les flux de règlement critiques. Elles exigent un calendrier de reprise.

**Actions attendues des participants** :

- L'exécutif BCE équilibre la sécurité monétaire et la stabilité du règlement.
- Le responsable technique fournit une mise à jour sur le "correctif".

## Points de décision

### Décision 1 : Seuil pour la pause globale

- **Question** : La frappe non autorisée est-elle suffisamment importante pour justifier une pause globale ?
- **Options autorisées** : Oui, toute frappe non autorisée menace l'intégrité de l'euro.
- **Options interdites** : Attendre un seuil spécifique en euros avant d'agir.
- **Conséquences** : Retarder la pause permet à une monnaie non garantie d'entrer dans l'économie.

### Décision 2 : Critères de reprise

- **Question** : Que faut-il vérifier avant de lever la pause ?
- **Options autorisées** : Réconciliation complète de l'offre totale et correctif vérifié.
- **Options interdites** : Reprise basée sur le temps écoulé ou la pression des participants.
- **Conséquences** : Une reprise prématurée peut permettre à l'exploitation de continuer.

## Critères d'évaluation

- **Exactitude technique** : Exécution réussie des commandes de pause et de reprise.
- **Respect des procédures** : Autorisation exécutive obtenue avant l'exécution technique.
- **Exhaustivité de l'audit** : Événements `SYSTEM_PAUSED` et `SYSTEM_RESUMED` enregistrés.
- **Clarté de la communication** : Alertes opportunes et précises au réseau de participants.

## Liste de contrôle de débriefing

- [ ] Combien de temps s'est-il écoulé entre la détection et la pause ?
- [ ] La chaîne de justification "Atténuation de vulnérabilité critique" a-t-elle été utilisée ?
- [ ] Tous les nœuds participants ont-ils reçu l'alerte de pause ?
- [ ] **Preuves collectées** : Événement blockchain `Paused`, blob d'autorisation signé.
- [ ] **Actions de suivi** : Réviser les protocoles de sécurité de "Reprise d'urgence".
