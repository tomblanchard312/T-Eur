# Tabletop-Übung 05: Notfall-Reaktion auf Schlüsselkompromittierung

## Übungsüberblick

### Ziel

Testen der Reaktion der EZB auf die Kompromittierung eines souveränen oder Teilnehmer-Schlüssels mit Fokus auf Widerruf, Isolierung und Wiederherstellung.

### Umfang

Widerruf eines kompromittierten `PARTICIPANT`-Schlüssels, Suspendierung der betroffenen Bank und Ausstellung eines Ersatzschlüssels.

### Teilnehmer und Rollen

- **Moderator**: Verwaltet den Fluss des Sicherheitsvorfalls.
- **Sicherheitsbeauftragter**: Erkennt und bestätigt die Kompromittierung.
- **EZB-Admin**: Führt den Widerruf und die Neuschlüsselung aus.
- **Teilnehmer-Liaison**: Koordiniert mit dem CISO der betroffenen Bank.

### Dauer

90 Minuten.

### Annahmen

- Der `ROOT`- oder `ISSUING`-Schlüssel ist sicher.
- Die Kompromittierung ist auf die Betriebsumgebung eines einzelnen Teilnehmers beschränkt.

## Szenario-Zeitplan

### T0: Ausgangsbedingungen

- Teilnehmer: Bank X.
- Aktiver Schlüssel: `bank-x-p-1`.
- Status: `ACTIVE`.

### T+10: Inject 1 - Kompromittierungsalarm

**Inject**: Ein Geheimdienstbericht bestätigt, dass der private Schlüssel für `bank-x-p-1` in einem Dark-Web-Forum veröffentlicht wurde.

**Erwartete Teilnehmeraktionen**:

- Sicherheitsbeauftragter verifiziert die Schlüssel-ID.
- EZB-Admin bereitet die Widerrufs-Benutzeroberfläche vor.

### T+20: Inject 2 - Unbefugte Aktivität

**Inject**: Das Ledger zeigt eine Reihe ungewöhnlicher Hochwert-Transfers, die vom Betriebswallet der Bank X unter Verwendung des kompromittierten Schlüssels ausgehen.

**Erwartete Teilnehmeraktionen**:

- EZB-Admin führt sofort den Befehl `REVOKE` für `bank-x-p-1` aus.
- Teilnehmer-Liaison benachrichtigt Bank X, ihr Gateway abzuschalten.

**Erwartete Systemreaktionen**:

- `GovernanceService` lehnt alle weiteren Anfragen von `bank-x-p-1` ab.
- Audit-Log protokolliert `KEY_REVOKED`.

### T+50: Inject 3 - Wiederherstellung und Neuschlüsselung

**Inject**: Bank X bestätigt, dass ihre Umgebung nun sicher ist, und fordert einen neuen Schlüssel an, um den Betrieb wiederaufzunehmen.

**Erwartete Teilnehmeraktionen**:

- EZB-Admin generiert und registriert `bank-x-p-2`.
- Sicherheitsbeauftragter verifiziert die Metadaten des neuen Schlüssels.

## Entscheidungspunkte

### Entscheidung 1: Sofortiger Widerruf vs. Beobachtung

- **Frage**: Sollte der Schlüssel sofort widerrufen oder überwacht werden, um den Angreifer zu identifizieren?
- **Zulässige Optionen**: Sofortiger Widerruf.
- **Unzulässige Optionen**: Überwachung (in Notfallprotokollen für Schlüsselkompromittierung verboten).
- **Konsequenzen**: Eine Verzögerung des Widerrufs ermöglicht es dem Angreifer, Gelder abzuziehen oder das Netzwerk zu stören.

### Entscheidung 2: Teilnehmer-Suspendierung

- **Frage**: Sollte Bank X vollständig suspendiert werden oder nur der kompromittierte Schlüssel?
- **Zulässige Optionen**: Suspendierung des Teilnehmers, bis ein vollständiges Sicherheitsaudit abgeschlossen ist.
- **Konsequenzen**: Nur den Schlüssel zu widerrufen, könnte andere Schwachstellen (z. B. sekundäre Schlüssel) ungeschützt lassen.

## Evaluationskriterien

- **Technische Korrektheit**: Erfolgreicher Widerruf der korrekten Schlüssel-ID.
- **Verfahrenstreue**: Sofortige Maßnahmen nach Bestätigung der Kompromittierung ergriffen.
- **Audit-Vollständigkeit**: Ereignisse `KEY_REVOKED` und `KEY_REGISTERED` protokolliert.
- **Kommunikationsklarheit**: Klare Anweisungen an den betroffenen Teilnehmer.

## Nachbesprechungs-Checkliste

- [ ] Wurde die korrekte `keyId` widerrufen?
- [ ] Hat der `GovernanceService` die unbefugten Transfers erfolgreich blockiert?
- [ ] Wurde der Ersatzschlüssel gemäß dem Standard-Registrierungsprozess ausgestellt?
- [ ] **Gesammelte Beweise**: Widerrufslogs, Registrierungsbeleg für den neuen Schlüssel.
- [ ] **Folgemaßnahmen**: Überprüfung der physischen Sicherheit der Teilnehmer-HSMs.
