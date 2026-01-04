# Tabletop-Übung 01: Notfall-Einfrieren eines Wallets

## Übungsüberblick

### Ziel

Validierung der Fähigkeit der EZB, ein Notfall-Einfrieren eines Wallets als Reaktion auf eine hochpriorisierte rechtliche Anordnung durchzuführen, wobei die Einhaltung von Verfahren und die Integrität des Audits sichergestellt werden.

### Umfang

Diese Übung deckt den End-to-End-Prozess vom Eingang einer rechtlichen Anordnung bis zur Verifizierung des eingefrorenen Status im tEUR-Ledger ab.

### Teilnehmer und Rollen

- **Moderator**: Verwaltet den Zeitplan der Übung und die Einspielungen (Injects).
- **EZB-Operator**: Führt den technischen Einfrierbefehl aus.
- **Compliance-Beauftragter**: Validiert die Rechtsgrundlage und die Begründung.
- **Sicherheitsbeauftragter**: Überwacht auf unbefugten Zugriff oder Schlüsselmissbrauch.
- **Beobachter/Auditor**: Protokolliert Aktionen für die Nachbesprechung.

### Dauer

60 Minuten.

### Annahmen

- Die Closed Settlement Plane (CSP) ist betriebsbereit.
- Der EZB-Operator besitzt einen gültigen `ISSUING`-Schlüssel.
- Das Ziel-Wallet ist derzeit im Ledger aktiv.

## Szenario-Zeitplan

### T0: Ausgangsbedingungen

- Systemstatus: `ACTIVE`.
- Ziel-Wallet: `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`.
- Kontostand: 1.250,00 €.

### T+05: Inject 1 - Eingang der rechtlichen Anordnung

**Inject**: Eine dringende E-Mail vom Europäischen Gerichtshof (EuGH) trifft ein, in der das sofortige Einfrieren des Wallets `0x71C...76F` wegen Verdachts auf Terrorismusfinanzierung angeordnet wird (Fall-ID: 2026-001).

**Erwartete Teilnehmeraktionen**:

- Compliance-Beauftragter verifiziert die Authentizität der Anordnung.
- EZB-Operator bereitet das Sovereign Control Portal vor.

### T+15: Inject 2 - Hochwert-Alarm (Optional)

**Inject**: Ein Monitoring-Alarm zeigt an, dass das Ziel-Wallet versucht, 1.000.000,00 € an eine externe Börse zu transferieren.

**Erwartete Teilnehmeraktionen**:

- EZB-Operator leitet sofort den Einfrierbefehl ein.
- Compliance-Beauftragter liefert den obligatorischen Begründungstext.

**Erwartete Systemreaktionen**:

- Die API gibt `200 OK` mit dem Transaktions-Hash zurück.
- Der Ledger-Status wird auf `frozen: true` aktualisiert.

### T+30: Inject 3 - Verifizierungsanfrage

**Inject**: Der EuGH fordert einen Nachweis an, dass die Gelder gesichert sind.

**Erwartete Teilnehmeraktionen**:

- EZB-Operator führt eine On-Chain-Abfrage durch, um den Status zu verifizieren.
- Sicherheitsbeauftragter ruft den Audit-Log-Eintrag ab.

## Entscheidungspunkte

### Entscheidung 1: Autorisierungsstufe

- **Frage**: Erfordert dieses Einfrieren das Vier-Augen-Prinzip (Doppelautorisierung)?
- **Zulässige Optionen**:
  - Nein, wenn der Kontostand unter 1.000.000 € liegt.
  - Ja, wenn der Kontostand oder der Transaktionsversuch 1.000.000 € übersteigt.
- **Konsequenzen**: Das Fortfahren ohne Doppelautorisierung bei Hochwertkonten führt zu einem Verfahrensfehler im Audit.

### Entscheidung 2: Begründungstext

- **Frage**: Welche Informationen müssen im Begründungsfeld enthalten sein?
- **Zulässige Optionen**: Fall-ID, Rechtsgrundlage und Zeitstempel.
- **Unzulässige Optionen**: Informelle Notizen oder leere Felder.
- **Konsequenzen**: Eine unvollständige Begründung macht den Audit-Trail nicht konform mit den DORA-Anforderungen.

## Evaluationskriterien

- **Technische Korrektheit**: Wurde die richtige Wallet-Adresse anvisiert und erfolgreich eingefroren?
- **Verfahrenstreue**: Wurden die Rollen korrekt eingehalten (z. B. Validierung durch Compliance vor Ausführung durch Operator)?
- **Audit-Vollständigkeit**: Enthält das Audit-Log die Fall-ID und die Signatur des `ISSUING`-Schlüssels?
- **Kommunikationsklarheit**: Waren die Status-Updates zwischen den Teilnehmern klar und prägnant?

## Nachbesprechungs-Checkliste

- [ ] Hat der Operator Copy-Paste für die Adresse verwendet?
- [ ] Wurde der Begründungstext korrekt eingegeben?
- [ ] Hat das System innerhalb der erwarteten Latenz reagiert?
- [ ] **Gesammelte Beweise**: API-Logs, Blockchain-Ereignisse, Portal-Screenshots.
- [ ] **Folgemaßnahmen**: Runbook aktualisieren, falls ein Schritt mehrdeutig war.
