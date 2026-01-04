# Trainingsszenario 03: Notfall-Treuhand-Hinterlegung (Escrow)

## Szenario-Titel

Isolierung strittiger Gelder via Treuhand (Escrow).

## Lernziele

- Unterscheidung zwischen einem vollständigen Einfrieren und einer Treuhand-Hinterlegung.
- Ausführung des Escrow-Befehls für einen bestimmten Betrag.
- Überprüfung des eingeschränkten Guthabens auf dem Zielkonto.

## Voraussetzungen

- Der Operator besitzt die Rolle `ECB_ADMIN` oder `NCB_OPERATOR`.
- Gültiger `OPERATIONAL`-Schlüssel.

## System-Ausgangszustand

- Zielkonto `0xABC...` hat ein Guthaben von 10.000,00 €.
- Keine aktiven Treuhand-Hinterlegungen auf dem Konto.

## Auslösendes Ereignis

Eine Geschäftsbank meldet eine verdächtige Transaktion über 5.000,00 €. Die Gelder müssen bis zum Abschluss einer 48-stündigen Untersuchung isoliert werden.

## Schritt-für-Schritt-Aktionen

1. **Identifikation**: Lokalisieren des Zielkontos in der Escrow-Benutzeroberfläche.
2. **Parametereingabe**: Eingabe des Betrags `500000` (Euro-Cent) und des Grundes "Laufende Betrugsuntersuchung - Fall #998".
3. **Ablauf-Einstellung**: Setzen des `expiresAt`-Zeitstempels auf 48 Stunden ab der aktuellen Zeit.
4. **Ausführung**: Klicken auf "In Treuhand hinterlegen" und Bestätigen.
5. **Verifizierung**: Überprüfung des verfügbaren Guthabens des Kontos (sollte 5.000,00 € sein) und des hinterlegten Guthabens (sollte 5.000,00 € sein).

## Erwartete Systemreaktionen

- Die API gibt `201 Created` mit einer `escrowId` zurück.
- Die Blockchain löst das Ereignis `FundsEscrowed` aus.
- Das verfügbare Guthaben wird sofort reduziert.

## Häufige Fehler

- Eingabe des Betrags in Euro statt in Cent (z. B. Eingabe von 5000 statt 500000).
- Einstellung einer automatischen Freigabe (bei Notfall-Escrows verboten).
- Verwechslung der `from`-Adresse mit der `payee`-Adresse.

## Erzeugte Audit-Artefakte

- Log-Ereignis `FUNDS_ESCROWED`.
- Blockchain-Transaktionsbeleg.
- Eintrag in der manuellen Prüfwarteschlange für den Compliance-Beauftragten.

## Abschlusskriterien

Der angegebene Betrag wurde erfolgreich in den Treuhandvertrag verschoben, und das verfügbare Guthaben des Kontos wurde korrekt eingeschränkt.
