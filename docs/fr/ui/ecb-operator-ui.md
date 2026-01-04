# Interface Opérateur BCE - Maquettes (Français)

Ce document présente des maquettes ASCII de l'interface de contrôle souverain de la BCE pour le système tEUR.

## 1. Tableau de bord de la BCE

**Objectif**: Vue d'ensemble de la santé du système et de l'état des réserves.

```text
+------------------------------------------------------------------------------+
| [ Contrôle Souverain BCE ]         Utilisateur: ecb-admin-01 | Rôle: OPÉRATIONNEL |
+------------------------------------------------------------------------------+
| [ Tableau de bord ] [ Sanctions ] [ Séquestre ] [ Opérations ] [ Sécurité ] [ Audit ] |
+------------------------------------------------------------------------------+
|                                                                              |
|  SANTÉ SYSTÈME: [ OK ]  |  RÉSEAU: [ ACTIF ]  |  ÉMISSION: [ ACTIVÉE ]       |
|                                                                              |
|  ÉTAT DES RÉSERVES                                                           |
|  +----------------------------+  +----------------------------+              |
|  | Offre Totale (tEUR)        |  | Solde de Réserve (EUR)     |              |
|  | 1 250 000 000,00           |  | 1 250 000 000,00           |              |
|  +----------------------------+  +----------------------------+              |
|                                                                              |
|  ALERTES ACTIVES                                                             |
|  - [AVERT] Transfert élevé détecté: 5 000 000,00 tEUR (Banque A -> Banque B) |
|  - [INFO] Rotation des clés prévue pour le 2026-01-15                        |
|                                                                              |
+------------------------------------------------------------------------------+
```

## 2. Gestion des sanctions

**Objectif**: Gel immédiat des portefeuilles selon les exigences réglementaires.

```text
+------------------------------------------------------------------------------+
| GESTION DES SANCTIONS                                                        |
+------------------------------------------------------------------------------+
| Adresse du Portefeuille: [ 0x1234...abcd ] [ Rechercher ]                    |
|                                                                              |
| Statut: ACTIF                                                                |
|                                                                              |
| [ ACTION: GELER L'ENTITÉ ] [ ACTION: DÉGELER L'ENTITÉ ]              |
| Motif: [ Sélectionner Motif...      |v]                                      |
| Justification: [ Correspondance LCB/FT - Dossier #882           ]            |
| Base Légale: [ Règlement UE 2024/123 ]                                       |
|                                                                              |
| [ CONFIRMER L'ACTION ] <-- Nécessite mTLS + Signature HSM                    |
|                                                                              |
| ACTIONS RÉCENTES                                                             |
| 2026-01-03 | 0x9876... | GELÉ     | Liste Sanctions v2.1 | Admin: ecb-02     |
| 2026-01-02 | 0x4455... | DÉGELÉ   | Avis Juridique Favorable | Admin: ecb-01 |
+------------------------------------------------------------------------------+
```

## 3. Gestion des séquestres

**Objectif**: Saisie légale et détention des fonds.

```text
+------------------------------------------------------------------------------+
| GESTION DES SÉQUESTRES                                                       |
+------------------------------------------------------------------------------+
| Portefeuille: [ 0xabcd...1234 ] | Solde Actuel: 50 000,00 tEUR               |
|                                                                              |
| [ PLACER SOUS SÉQUESTRE ]                                                    |
| Montant: [ 25 000,00 ] tEUR                                                  |
| Base Légale: [ Ordonnance 2026-XYZ ]                                         |
| Expiration: [ 2026-06-01 ] (Optionnel)                                       |
|                                                                              |
| [ EXÉCUTER LE SÉQUESTRE ]                                                    |
|                                                                              |
| SÉQUESTRES ACTIFS                                                            |
| ID: ESC-99 | 0xabcd... | 25 000,00 | [ LIBÉRER ] [ DÉTRUIRE ]                |
+------------------------------------------------------------------------------+
```

## 4. Opérations monétaires

**Objectif**: Émission, destruction et suspension globale.

```text
+------------------------------------------------------------------------------+
| OPÉRATIONS MONÉTAIRES                                                        |
+------------------------------------------------------------------------------+
| [ ÉMETTRE tEUR ]                                                             |
| Vers: [ Compte de Réserve ]                                                  |
| Montant: [ 10 000 000,00 ]                                                   |
| Justification: [ Expansion des Réserves ]                                    |
| [ CONFIRMER L'ÉMISSION ]                                                     |
|                                                                              |
| [ DÉTRUIRE tEUR ]                                                            |
| Depuis: [ Compte de Réserve ]                                                |
| Montant: [ 5 000 000,00 ]                                                    |
| [ CONFIRMER LA DESTRUCTION ]                                                 |
|                                                                              |
| CONTRÔLES D'URGENCE                                                          |
| [ SUSPENDRE TOUTE ÉMISSION ] <-- BOUTON D'ARRÊT GLOBAL                       |
| Statut: [ ACTIF ]                                                            |
+------------------------------------------------------------------------------+
```

## 5. Sécurité et clés

**Objectif**: Gestion du cycle de vie des clés souveraines.

```text
+------------------------------------------------------------------------------+
| SÉCURITÉ ET CLÉS                                                             |
+------------------------------------------------------------------------------+
| CLÉS ACTIVES                                                                 |
| ID: ecb-root-01 | Rôle: ROOT    | Statut: ACTIF | [ ROTATION ]               |
| ID: ecb-iss-01  | Rôle: ISSUING | Statut: ACTIF | [ ROTATION ]               |
| ID: bank-a-p-01 | Rôle: PARTICIP. | Statut: ACTIF | [ RÉVOQUER ]             |
|                                                                              |
| [ RÉVOQUER LA CLÉ ] [ ISOLER LE PARTICIPANT ]                                |
| ID Cible: [ bank-a-p-01 ]                                                    |
| Motif: [ Compromission Suspectée ]                                           |
| [ CONFIRMER L'ACTION ]                                                       |
|                                                                              |
| * ISOLER LE PARTICIPANT: Révoque toutes les clés et bloque l'accès CSP.      |
+------------------------------------------------------------------------------+
```

## 6. Vue d'audit

**Objectif**: Chronologie immuable des événements pour les auditeurs.

```text
+------------------------------------------------------------------------------+
| JOURNAL D'AUDIT                                                              |
+------------------------------------------------------------------------------+
| Filtre: [ Toutes Actions |v] [ Période |v] [ Rechercher... ]                 |
|                                                                              |
| HORODATAGE          | ACTEUR     | ACTION         | DÉTAILS                  |
| 2026-01-03 10:00:01 | ecb-admin  | ÉMISSION       | 10M tEUR vers Réserve    |
| 2026-01-03 10:15:22 | ecb-admin  | GEL_COMPTE     | 0x1234... (Sanctions)    |
| 2026-01-03 10:45:10 | système    | CLÉ_ROTÉE      | ecb-iss-01 -> ecb-iss-02 |
|                                                                              |
| [ EXPORTER LES PREUVES (PDF/JSON) ]                                          |
+------------------------------------------------------------------------------+
```
