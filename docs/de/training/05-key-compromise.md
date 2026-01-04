# Trainingsszenario 05: Notfall-Reaktion auf Schlüsselkompromittierung

## Szenario-Titel

Eindämmung und Wiederherstellung nach einer Schlüsselkompromittierung.

## Lernziele

- Widerruf eines kompromittierten Schlüssels in der souveränen Hierarchie.
- Isolierung eines betroffenen Teilnehmers.
- Registrierung eines Ersatzschlüssels.

## Voraussetzungen

- Der Operator besitzt die Rolle `ECB_ADMIN`.
- Gültiger `ROOT`- oder `ISSUING`-Schlüssel vorhanden.

## System-Ausgangszustand

- Teilnehmer "Bank X" hat einen aktiven `PARTICIPANT`-Schlüssel `bank-x-p-1`.
- Das System ist `ACTIVE`.

## Auslösendes Ereignis

Sicherheitserkenntnisse bestätigen, dass der private Schlüssel für `bank-x-p-1` exfiltriert wurde.

## Schritt-für-Schritt-Aktionen

1. **Widerruf**: Lokalisieren von `bank-x-p-1` in der Sicherheits-Benutzeroberfläche und Klicken auf "WIDERRUFEN".
2. **Begründung**: Eingabe von "Bestätigte Schlüsselkompromittierung - Vorfall #2026-05".
3. **Isolierung**: Deaktivieren des Teilnehmers "Bank X" in der Teilnehmerverwaltungs-Benutzeroberfläche.
4. **Ersatz**: Generieren und Registrieren eines neuen Schlüssels `bank-x-p-2` für den Teilnehmer.
5. **Verifizierung**: Versuch, den alten Schlüssel zu verwenden, und Bestätigung, dass dieser mit `KEY_REVOKED` abgelehnt wird.

## Erwartete Systemreaktionen

- Der `GovernanceService` aktualisiert den Schlüsselstatus auf `REVOKED`.
- Alle mit dem alten Schlüssel signierten Anfragen werden sofort blockiert.
- Das Audit-Log zeichnet `KEY_REVOKED` auf.

## Häufige Fehler

- Widerruf des falschen Schlüssels (die `keyId` zweimal überprüfen).
- Versäumnis, den Teilnehmer zu isolieren, wodurch dieser Sekundärschlüssel verwenden könnte, falls vorhanden.
- Verzögerung des Widerrufs zwecks "Untersuchung" (der Widerruf muss sofort erfolgen).

## Erzeugte Audit-Artefakte

- Log-Ereignis `KEY_REVOKED`.
- Log-Ereignis `KEY_REGISTERED` für den neuen Schlüssel.
- Aktualisierter Schnappschuss der Governance-Hierarchie.

## Abschlusskriterien

Der kompromittierte Schlüssel wurde erfolgreich widerrufen, der Teilnehmer wurde isoliert und ein neuer sicherer Schlüssel wurde registriert.
