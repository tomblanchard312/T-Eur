# Scénario de formation 02 : Escalade d'urgence des sanctions

## Titre du scénario

Propagation rapide des sanctions à l'échelle du réseau.

## Objectifs d'apprentissage

- Exécuter des opérations de gel par lots pour plusieurs entités.
- Synchroniser le miroir interne des sanctions.
- Vérifier la propagation du manifeste aux participants.

## Préconditions

- L'opérateur a le rôle `ECB_ADMIN`.
- Accès à l'interface de gestion centrale de la BCE.
- Clé `ISSUING` valide.

## État initial du système

- Plusieurs entités cibles sont actives auprès de différentes banques participantes.
- La version du manifeste du système est `v1.0.42`.

## Événement déclencheur

Mise à jour par le Conseil européen de la liste consolidée des sanctions exigeant le blocage immédiat de plus de 50 adresses de portefeuilles associées.

## Actions étape par étape

1. **Préparation du lot** : Charger le fichier `sanctions-list-2026-01-03.json` fourni dans l'utilitaire de traitement par lots.
2. **Exécution** : Exécuter le script de gel par lots au sein du CSP.
3. **Synchronisation du miroir** : Déclencher la synchronisation du service interne `ecb-mirror`.
4. **Diffusion du manifeste** : Confirmer la génération du nouveau `ecb-manifest.json`.
5. **Vérification** : Vérifier qu'au moins trois nœuds participants ont accusé réception de la nouvelle version du manifeste.

## Réponses attendues du système

- Le script par lots rapporte un taux de réussite de 100 % pour toutes les adresses.
- Le hachage de `ecb-manifest` est mis à jour et signé.
- Les nœuds participants signalent `MANIFEST_UPDATED` dans le tableau de bord de surveillance.

## Erreurs courantes à éviter

- Exécuter le script par lots contre le mauvais environnement (ex: Lab au lieu de Production).
- Omettre de déclencher la synchronisation du miroir, entraînant des approbations de transactions dans des cas limites.
- Ignorer les délais de propagation du manifeste.

## Artefacts d'audit produits

- Événement de journal `SANCTIONS_ESCALATION`.
- Version `v1.0.43` signée de `ecb-manifest.json`.
- Rapport d'exécution par lots stocké dans le service d'audit.

## Critères d'achèvement

Toutes les adresses de la liste sont gelées sur la blockchain, et le manifeste mis à jour est diffusé avec succès sur le réseau.
