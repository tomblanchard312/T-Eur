# EZB-Bedieneroberfläche - Mockups (Deutsch)

Dieses Dokument enthält ASCII-Mockups der EZB-Souveränitätskontrollschnittstelle für das tEUR-System.

## 1. EZB-Dashboard

**Zweck**: Allgemeiner Überblick über den Systemzustand und den Reservestatus.

```text
+------------------------------------------------------------------------------+
| [ EZB-Souveränitätskontrolle ]     Benutzer: ecb-admin-01 | Rolle: OPERATIV  |
+------------------------------------------------------------------------------+
| [ Dashboard ] [ Sanktionen ] [ Treuhand ] [ Währungs-Ops ] [ Sicherheit ] [ Audit ] |
+------------------------------------------------------------------------------+
|                                                                              |
|  SYSTEMZUSTAND: [ OK ]  |  NETZWERK: [ AKTIV ]  |  EMISSION: [ AKTIVIERT ]   |
|                                                                              |
|  RESERVESTATUS                                                               |
|  +----------------------------+  +----------------------------+              |
|  | Gesamtangebot (tEUR)       |  | Reserveguthaben (EUR)      |              |
|  | 1.250.000.000,00           |  | 1.250.000.000,00           |              |
|  +----------------------------+  +----------------------------+              |
|                                                                              |
|  AKTIVE ALARME                                                               |
|  - [WARN] Hoher Transfer erkannt: 5.000.000,00 tEUR (Bank A -> Bank B)       |
|  - [INFO] Schlüsselrotation für 2026-01-15 geplant                           |
|                                                                              |
+------------------------------------------------------------------------------+
```

## 2. Sanktionsmanagement

**Zweck**: Sofortiges Einfrieren von Wallets basierend auf regulatorischen Anforderungen.

```text
+------------------------------------------------------------------------------+
| SANKTIONSMANAGEMENT                                                          |
+------------------------------------------------------------------------------+
| Wallet-Adresse: [ 0x1234...abcd ] [ Suchen ]                                 |
|                                                                              |
| Status: AKTIV                                                                |
|                                                                              |
| [ AKTION: ENTITÄT EINFRIEREN ] [ AKTION: ENTITÄT ENTSPERREN ]         |
| Grund: [ Grund auswählen...         |v]                                      |
| Begründung: [ GWG/TFG-Treffer - Fall #882                       ]            |
| Rechtsgrundlage: [ EU-Verordnung 2024/123 ]                                  |
|                                                                              |
| [ AKTION BESTÄTIGEN ] <-- Erfordert mTLS + HSM-Signatur                      |
|                                                                              |
| LETZTE AKTIONEN                                                              |
| 2026-01-03 | 0x9876... | GEFROREN | Sanktionsliste v2.1 | Admin: ecb-02      |
| 2026-01-02 | 0x4455... | ENTSPERRT| Rechtliche Prüfung OK | Admin: ecb-01     |
+------------------------------------------------------------------------------+
```

## 3. Treuhandverwaltung

**Zweck**: Rechtliche Beschlagnahme und Verwahrung von Geldern.

```text
+------------------------------------------------------------------------------+
| TREUHANDVERWALTUNG                                                           |
+------------------------------------------------------------------------------+
| Wallet: [ 0xabcd...1234 ] | Aktuelles Guthaben: 50.000,00 tEUR               |
|                                                                              |
| [ AUF TREUHANDKONTO ÜBERTRAGEN ]                                             |
| Betrag: [ 25.000,00 ] tEUR                                                   |
| Rechtsgrundlage: [ Gerichtsbeschluss 2026-XYZ ]                              |
| Ablaufdatum: [ 2026-06-01 ] (Optional)                                       |
|                                                                              |
| [ TREUHAND AUSFÜHREN ]                                                       |
|                                                                              |
| AKTIVE TREUHANDKONTEN                                                        |
| ID: ESC-99 | 0xabcd... | 25.000,00 | [ FREIGEBEN ] [ VERNICHTEN ]            |
+------------------------------------------------------------------------------+
```

## 4. Währungspolitische Operationen

**Zweck**: Emission, Vernichtung und globale Aussetzung.

```text
+------------------------------------------------------------------------------+
| WÄHRUNGSPOLITISCHE OPERATIONEN                                               |
+------------------------------------------------------------------------------+
| [ tEUR EMITTIEREN ]                                                          |
| An: [ Reservekonto ]                                                         |
| Betrag: [ 10.000.000,00 ]                                                    |
| Begründung: [ Reserveausweitung ]                                            |
| [ EMISSION BESTÄTIGEN ]                                                      |
|                                                                              |
| [ tEUR VERNICHTEN ]                                                          |
| Von: [ Reservekonto ]                                                        |
| Betrag: [ 5.000.000,00 ]                                                     |
| [ VERNICHTUNG BESTÄTIGEN ]                                                   |
|                                                                              |
| NOTFALLKONTROLLEN                                                            |
| [ ALLE EMISSIONEN AUSSETZEN ] <-- GLOBALER NOTAUS-SCHALTER                   |
| Status: [ AKTIV ]                                                            |
+------------------------------------------------------------------------------+
```

## 5. Sicherheit und Schlüssel

**Zweck**: Lebenszyklusmanagement souveräner Schlüssel.

```text
+------------------------------------------------------------------------------+
| SICHERHEIT & SCHLÜSSEL                                                       |
+------------------------------------------------------------------------------+
| AKTIVE SCHLÜSSEL                                                             |
| ID: ecb-root-01 | Rolle: ROOT    | Status: AKTIV | [ ROTIEREN ]              |
| ID: ecb-iss-01  | Rolle: ISSUING | Status: AKTIV | [ ROTIEREN ]              |
| ID: bank-a-p-01 | Rolle: TEILNEHM. | Status: AKTIV | [ WIDERRUFEN ]          |
|                                                                              |
| [ SCHLÜSSEL WIDERRUFEN ] [ TEILNEHMER ISOLIEREN ]                            |
| Ziel-ID: [ bank-a-p-01 ]                                                     |
| Grund: [ Verdacht auf Kompromittierung ]                                     |
| [ AKTION BESTÄTIGEN ]                                                        |
|                                                                              |
| * TEILNEHMER ISOLIEREN: Widerruft alle Schlüssel und sperrt CSP-Zugang.      |
+------------------------------------------------------------------------------+
```

## 6. Audit-Ansicht

**Zweck**: Unveränderliche Ereignis-Timeline für Auditoren.

```text
+------------------------------------------------------------------------------+
| AUDIT-PROTOKOLL                                                              |
+------------------------------------------------------------------------------+
| Filter: [ Alle Aktionen |v] [ Zeitraum |v] [ Suchen... ]                     |
|                                                                              |
| ZEITSTEMPEL         | AKTEUR     | AKTION         | DETAILS                  |
| 2026-01-03 10:00:01 | ecb-admin  | EMISSION       | 10M tEUR an Reserve      |
| 2026-01-03 10:15:22 | ecb-admin  | KONTO_SPERREN  | 0x1234... (Sanktionen)   |
| 2026-01-03 10:45:10 | System     | SCHLÜSSEL_ROT. | ecb-iss-01 -> ecb-iss-02 |
|                                                                              |
| [ BEWEISMITTEL EXPORTIEREN (PDF/JSON) ]                                      |
+------------------------------------------------------------------------------+
```
