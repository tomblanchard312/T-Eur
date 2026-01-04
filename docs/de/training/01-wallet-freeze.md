# Trainingsszenario 01: Notfall-Einfrieren eines Wallets

## Szenario-Titel

Durchführung eines Notfall-Einfrierens eines Wallets zur Einhaltung von Sanktionen.

## Lernziele

- Korrekte Identifizierung der Ziel-Wallet-Adresse.
- Ausführung des Einfrierbefehls über das Sovereign Control Portal oder die API.
- Überprüfung des eingefrorenen Status auf der Blockchain.
- Verständnis des durch die Aktion erzeugten Audit-Trails.

## Voraussetzungen

- Der Operator besitzt die Rolle `ECB_ADMIN`.
- Der Operator besitzt einen gültigen `ISSUING`-Schlüssel.
- Der Zugang zum Closed Settlement Plane (CSP) ist hergestellt.

## System-Ausgangszustand

- Ziel-Wallet `0x71C7656EC7ab88b098defB751B7401B5f6d8976F` ist aktiv.
- Kontostand beträgt 1.250,00 €.
- Systemstatus ist `ACTIVE`.

## Auslösendes Ereignis

Eingang einer offiziellen rechtlichen Anordnung (Fall-ID: 2026-001), die das sofortige Einfrieren des Ziel-Wallets aufgrund einer Sanktionslistung erfordert.

## Schritt-für-Schritt-Aktionen

1. **Authentifizierung**: Anmeldung am Sovereign Control Portal mittels mTLS und dem `ISSUING`-Schlüssel.
2. **Identifikation**: Eingabe der Zieladresse `0x71C7656EC7ab88b098defB751B7401B5f6d8976F` in der Sanktions-Benutzeroberfläche.
3. **Begründung**: Eingabe der obligatorischen Begründung: "Notfall-Sanktionseinhaltung - Fall-ID: 2026-001".
4. **Ausführung**: Klicken auf "Konto einfrieren" und Bestätigung der Aktion im Sicherheitsmodal.
5. **Verifizierung**: Abfrage des Kontostatus zur Bestätigung von `frozen: true`.

## Erwartete Systemreaktionen

- Die API gibt `200 OK` mit einem Transaktions-Hash zurück.
- Die Blockchain löst das Ereignis `AccountFrozen` aus.
- Das Audit-Log zeichnet das Ereignis `ACCOUNT_FROZEN` auf.

## Häufige Fehler

- Eingabe der falschen Wallet-Adresse (immer Copy-Paste verwenden).
- Vergessen der rechtlichen Referenz in der Begründung.
- Versäumnis, die Statusänderung nach der Ausführung zu überprüfen.

## Erzeugte Audit-Artefakte

- Log-Eintrag `ACCOUNT_FROZEN` im Audit-Service.
- Blockchain-Transaktionsbeleg.
- Signierter Eintrag im Governance-Service, der die Aktion mit dem `ISSUING`-Schlüssel verknüpft.

## Abschlusskriterien

Das Ziel-Wallet wurde erfolgreich eingefroren und die Aktion wurde sowohl über die Benutzeroberfläche als auch über eine direkte Blockchain-Abfrage verifiziert.
