# Tabletop-Übung 02: Notfall-Sanktionsekalation

## Übungsüberblick

### Ziel

Testen der schnellen Verbreitung netzwerkweiter Sanktionen im tEUR-Ökosystem mit Fokus auf Batch-Verarbeitung und Manifest-Synchronisierung.

### Umfang

Batch-Einfrieren von über 50 Adressen und die anschließende Verbreitung eines aktualisierten System-Manifests an alle Teilnehmer.

### Teilnehmer und Rollen

- **Moderator**: Steuert den Szenariofluss.
- **EZB-Admin**: Führt Batch-Skripte aus und signiert das Manifest.
- **Netzwerkbetrieb**: Überwacht die Synchronisierung der Teilnehmerknoten.
- **Compliance-Leiter**: Genehmigt die konsolidierte Sanktionsliste.

### Dauer

90 Minuten.

### Annahmen

- Das Batch-Verarbeitungsprogramm ist konfiguriert.
- Der `ecb-mirror`-Dienst ist aktiv.
- Alle Teilnehmerknoten sind mit der CSP verbunden.

## Szenario-Zeitplan

### T0: Ausgangsbedingungen

- System-Manifest: `v1.0.42`.
- Netzwerkstatus: Stabil.

### T+10: Inject 1 - Sanktionsaktualisierung

**Inject**: Der Europäische Rat veröffentlicht eine Notfallaktualisierung der konsolidierten Sanktionsliste. 52 neue Wallet-Adressen müssen sofort gesperrt werden.

**Erwartete Teilnehmeraktionen**:

- Compliance-Leiter validiert die Liste und formatiert sie für das Batch-Programm.
- EZB-Admin lädt `sanctions-list-2026-01-03.json`.

### T+25: Inject 2 - Batch-Ausführung

**Inject**: Das Batch-Skript wird ausgeführt. 48 Adressen werden erfolgreich eingefroren, aber 4 Adressen geben `INVALID_ADDRESS` zurück.

**Erwartete Teilnehmeraktionen**:

- EZB-Admin untersucht die 4 Fehler.
- Compliance-Leiter bestätigt, ob die Adressen in der Quellliste falsch geschrieben wurden.

### T+45: Inject 3 - Manifest-Verbreitung

**Inject**: Das neue Manifest `v1.0.43` wird signiert und verbreitet. Eine Teilnehmerbank (Bank Y) bestätigt den Empfang der Aktualisierung nicht.

**Erwartete Teilnehmeraktionen**:

- Netzwerkbetrieb kontaktiert das technische Team von Bank Y.
- EZB-Admin verifiziert den Manifest-Hash auf dem sekundären Validator.

## Entscheidungspunkte

### Entscheidung 1: Umgang mit Batch-Fehlern

- **Frage**: Sollte das Manifest aktualisiert werden, wenn 4 Adressen nicht eingefroren werden konnten?
- **Zulässige Optionen**:
  - Ja, Aktualisierung für die 48 erfolgreichen, dann erneute Ausführung für die verbleibenden 4.
  - Nein, warten bis alle 52 gelöst sind.
- **Konsequenzen**: Eine Verzögerung der Manifest-Aktualisierung lässt 48 sanktionierte Einheiten im Netzwerk aktiv.

### Entscheidung 2: Nicht-Konformität eines Teilnehmers

- **Frage**: Welche Maßnahme wird ergriffen, wenn Bank Y auf dem alten Manifest bleibt?
- **Zulässige Optionen**: Suspendierung des Teilnehmer-Schlüssels von Bank Y bis zur Synchronisierung.
- **Unzulässige Optionen**: Ignorieren der Diskrepanz.
- **Konsequenzen**: Einem Teilnehmer den Betrieb mit einem alten Manifest zu erlauben, schafft ein Risiko zur Umgehung von Sanktionen.

## Evaluationskriterien

- **Technische Korrektheit**: Erfolgreiche Ausführung des Batch-Skripts und Signierung des Manifests.
- **Verfahrenstreue**: Validierung der Sanktionsliste vor der Ausführung.
- **Audit-Vollständigkeit**: Erstellung des `SANCTIONS_ESCALATION`-Logs und des signierten Manifests.
- **Kommunikationsklarheit**: Koordination zwischen EZB und Teilnehmerbanken.

## Nachbesprechungs-Checkliste

- [ ] War das Batch-Dateiformat korrekt?
- [ ] Wie lange dauerte die Manifest-Verbreitung im Netzwerk?
- [ ] Wurden die 4 fehlerhaften Adressen gelöst?
- [ ] **Gesammelte Beweise**: Signiertes `ecb-manifest.json`, Batch-Ausführungslogs.
- [ ] **Folgemaßnahmen**: Überprüfung der Konnektivitätsanforderungen für Teilnehmerknoten.
