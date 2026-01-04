# Trainingsszenario 04: Notfall-Emissionsaussetzung (Mint Suspension)

## Szenario-Titel

Globale Aussetzung monetärer Operationen.

## Lernziele

- Durchführung einer globalen Systempause.
- Verständnis der Auswirkungen auf das Settlement und die Teilnehmer.
- Sichere Durchführung des Wiederaufnahmeverfahrens (Unpause).

## Voraussetzungen

- Der Operator besitzt die Rolle `ECB_ADMIN`.
- Gültiger `ISSUING`-Schlüssel.

## System-Ausgangszustand

- Systemstatus ist `ACTIVE`.
- Gesamtumlaufmenge beträgt 1.250.000.000,00 €.

## Auslösendes Ereignis

Erkennung einer kritischen Schwachstelle im Smart Contract, die unbefugtes Minting ermöglicht. Eine sofortige Aussetzung ist zum Schutz der monetären Souveränität erforderlich.

## Schritt-für-Schritt-Aktionen

1. **Notfall-Pause**: Navigieren zur System-Admin-Benutzeroberfläche und Klicken auf "GLOBALE PAUSE".
2. **Begründung**: Eingabe von "Eindämmung kritischer Schwachstellen - Vorfall #2026-04".
3. **Verifizierung**: Bestätigung von `isPaused() == true` über das Dashboard.
4. **Teilnehmer-Benachrichtigung**: Überprüfung, ob der Alarm `SYSTEM_PAUSED` gesendet wurde.
5. **Wiederherstellung (Simuliert)**: Nach Anwendung des "Patches" Ausführung des Befehls "GLOBALE WIEDERAUFNAHME".

## Erwartete Systemreaktionen

- Alle neuen Transfer- und Mint-Anfragen werden mit `SYSTEM_PAUSED` abgelehnt.
- Der Blockchain-Status `paused` wird auf `true` gesetzt.
- Das Audit-Log zeichnet `SYSTEM_PAUSED` auf.

## Häufige Fehler

- Zögern beim Pausieren während des Wartens auf eine sekundäre Bestätigung (Notfallprotokolle priorisieren die Eindämmung).
- Versäumnis, die Pause auf der Blockchain zu verifizieren.
- Wiederaufnahme des Betriebs vor Abschluss einer vollständigen Integritätsprüfung der Abstimmung (Reconciliation).

## Erzeugte Audit-Artefakte

- Log-Ereignis `SYSTEM_PAUSED`.
- Blockchain-Ereignis `Paused`.
- Signierter Autorisierungs-Blob im Audit-Service.

## Abschlusskriterien

Das System wurde erfolgreich pausiert, alle monetären Operationen wurden gestoppt und das System wurde nach der simulierten Fehlerbehebung sicher wieder aufgenommen.
