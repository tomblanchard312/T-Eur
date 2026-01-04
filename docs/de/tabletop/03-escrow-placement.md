# Tabletop-Übung 03: Notfall-Treuhand-Hinterlegung (Escrow)

## Übungsüberblick

### Ziel

Validierung des Verfahrens zur Isolierung strittiger Gelder unter Verwendung des tEUR-Escrow-Mechanismus, wobei sichergestellt wird, dass Gelder ohne vollständige Kontosperrung eingeschränkt werden.

### Umfang

Hinterlegung spezifischer Gelder im Treuhandkonto (Escrow), Verwaltung von Ablaufzeitstempeln und Verifizierung eingeschränkter Guthaben.

### Teilnehmer und Rollen

- **Moderator**: Verwaltet die Einspielungen (Injects).
- **NZB-Operator**: Leitet die Escrow-Anfrage ein.
- **EZB-Compliance**: Genehmigt die Escrow-Parameter.
- **Geschäftsbanken-Liaison**: Kommuniziert mit der meldenden Bank.

### Dauer

45 Minuten.

### Annahmen

- Das Zielkonto verfügt über ausreichendes Guthaben.
- Der `OPERATIONAL`-Schlüssel ist für den NZB-Operator verfügbar.

## Szenario-Zeitplan

### T0: Ausgangsbedingungen

- Zielkonto: `0xABC...123`.
- Kontostand: 10.000,00 €.
- Status: `ACTIVE`.

### T+05: Inject 1 - Betrugsmeldung

**Inject**: Eine Geschäftsbank meldet, dass eine Überweisung von 5.000,00 € an `0xABC...123` unbefugt war. Sie fordern, dass die Gelder für 48 Stunden einbehalten werden.

**Erwartete Teilnehmeraktionen**:

- Geschäftsbanken-Liaison bestätigt die Transaktionsdetails.
- NZB-Operator bereitet die Escrow-Benutzeroberfläche vor.

### T+15: Inject 2 - Parameterkonflikt

**Inject**: Die meldende Bank fordert eine unbefristete Sperre, aber das tEUR-Regelwerk begrenzt Notfall-Escrows auf 72 Stunden ohne Gerichtsbeschluss.

**Erwartete Teilnehmeraktionen**:

- EZB-Compliance setzt das 72-Stunden-Limit durch.
- NZB-Operator setzt `expiresAt` auf T+48 Stunden.

### T+25: Inject 3 - Ausführung und Verifizierung

**Inject**: Das Escrow wird ausgeführt. Der Kontoinhaber versucht, die vollen 10.000,00 € auszugeben.

**Erwartete Teilnehmeraktionen**:

- NZB-Operator verifiziert das Scheitern der Transaktion für den eingeschränkten Betrag.
- EZB-Compliance überprüft das `FUNDS_ESCROWED` Audit-Log.

## Entscheidungspunkte

### Entscheidung 1: Escrow vs. Einfrieren

- **Frage**: Warum sollte Escrow statt eines vollständigen Einfrierens verwendet werden?
- **Zulässige Optionen**: Um dem Kontoinhaber zu ermöglichen, nicht strittige Gelder (5.000,00 €) weiterhin zu verwenden.
- **Unzulässige Optionen**: Einfrieren des gesamten Kontos bei einem teilweisen Streitfall.
- **Konsequenzen**: Unnötiges Einfrieren des gesamten Kontos kann zu rechtlicher Haftung für die EZB führen.

### Entscheidung 2: Ablaufverwaltung

- **Frage**: Was passiert, wenn die 48 Stunden ohne Klärung ablaufen?
- **Zulässige Optionen**: Gelder werden automatisch freigegeben, sofern keine manuelle Verlängerung oder Sperre angewendet wird.
- **Konsequenzen**: Ein Versäumnis bei der Überwachung des Ablaufs kann zum Verlust strittiger Gelder führen.

## Evaluationskriterien

- **Technische Korrektheit**: Korrekter Betrag und Ablauf im Escrow-Befehl gesetzt.
- **Verfahrenstreue**: Einhaltung des 72-Stunden-Limits des Regelwerks.
- **Audit-Vollständigkeit**: Verifizierung der `escrowId` und des Blockchain-Ereignisses.
- **Kommunikationsklarheit**: Klare Erläuterung gegenüber der meldenden Bank bezüglich der Haltedauer.

## Nachbesprechungs-Checkliste

- [ ] Wurde der Betrag in Cent eingegeben (500000)?
- [ ] Wurde der `expiresAt`-Zeitstempel korrekt berechnet?
- [ ] War die Teilüberweisung des Kontoinhabers wie erwartet erfolgreich?
- [ ] **Gesammelte Beweise**: `FundsEscrowed`-Ereignis, API-Antwort.
- [ ] **Folgemaßnahmen**: Überprüfung des automatisierten Benachrichtigungssystems für ablaufende Escrows.
