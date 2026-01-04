# Exercice sur table 02 : Escalade d'urgence des sanctions

## Aperçu de l'exercice

### Objectif

Tester la propagation rapide des sanctions à l'échelle du réseau dans l'écosystème tEUR, en se concentrant sur le traitement par lots et la synchronisation des manifestes.

### Portée

Gel par lots de plus de 50 adresses et diffusion ultérieure d'un manifeste système mis à jour à tous les participants.

### Participants et rôles

- **Facilitateur** : Contrôle le flux du scénario.
- **Admin BCE** : Exécute les scripts par lots et signe le manifeste.
- **Opérations réseau** : Surveille la synchronisation des nœuds participants.
- **Responsable conformité** : Approuve la liste consolidée des sanctions.

### Durée

90 minutes.

### Hypothèses

- L'utilitaire de traitement par lots est configuré.
- Le service `ecb-mirror` est actif.
- Tous les nœuds participants sont connectés au CSP.

## Chronologie du scénario

### T0 : Conditions initiales

- Manifeste système : `v1.0.42`.
- Statut du réseau : Stable.

### T+10 : Injection 1 - Mise à jour des sanctions

**Injection** : Le Conseil européen publie une mise à jour d'urgence de la liste consolidée des sanctions. 52 nouvelles adresses de portefeuilles doivent être bloquées immédiatement.

**Actions attendues des participants** :

- Le responsable conformité valide la liste et la formate pour l'utilitaire par lots.
- L'admin BCE charge `sanctions-list-2026-01-03.json`.

### T+25 : Injection 2 - Exécution par lots

**Injection** : Le script par lots est exécuté. 48 adresses sont gelées avec succès, mais 4 adresses renvoient `INVALID_ADDRESS`.

**Actions attendues des participants** :

- L'admin BCE enquête sur les 4 échecs.
- Le responsable conformité confirme si les adresses ont été mal saisies dans la liste source.

### T+45 : Injection 3 - Propagation du manifeste

**Injection** : Le nouveau manifeste `v1.0.43` est signé et diffusé. Une banque participante (Banque Y) ne parvient pas à accuser réception de la mise à jour.

**Actions attendues des participants** :

- Les opérations réseau contactent l'équipe technique de la Banque Y.
- L'admin BCE vérifie le hachage du manifeste sur le validateur secondaire.

## Points de décision

### Décision 1 : Gestion des échecs par lots

- **Question** : Le manifeste doit-il être mis à jour si 4 adresses n'ont pas pu être gelées ?
- **Options autorisées** :
  - Oui, mettre à jour pour les 48 réussites, puis relancer pour les 4 restantes.
  - Non, attendre que les 52 soient résolues.
- **Conséquences** : Retarder la mise à jour du manifeste laisse 48 entités sanctionnées actives sur le réseau.

### Décision 2 : Non-conformité d'un participant

- **Question** : Quelle action est entreprise si la Banque Y reste sur l'ancien manifeste ?
- **Options autorisées** : Suspendre la clé de participant de la Banque Y jusqu'à la synchronisation.
- **Options interdites** : Ignorer l'écart.
- **Conséquences** : Autoriser un participant à opérer sur un ancien manifeste crée un risque de contournement des sanctions.

## Critères d'évaluation

- **Exactitude technique** : Exécution réussie du script par lots et signature du manifeste.
- **Respect des procédures** : Validation de la liste des sanctions avant exécution.
- **Exhaustivité de l'audit** : Génération du journal `SANCTIONS_ESCALATION` et du manifeste signé.
- **Clarté de la communication** : Coordination entre la BCE et les banques participantes.

## Liste de contrôle de débriefing

- [ ] Le format du fichier par lots était-il correct ?
- [ ] Combien de temps la propagation du manifeste a-t-elle pris sur le réseau ?
- [ ] Les 4 adresses en échec ont-elles été résolues ?
- [ ] **Preuves collectées** : `ecb-manifest.json` signé, journaux d'exécution par lots.
- [ ] **Actions de suivi** : Réviser les exigences de connectivité des nœuds participants.
