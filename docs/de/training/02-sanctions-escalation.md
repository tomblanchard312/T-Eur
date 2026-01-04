# Trainingsszenario 02: Notfall-Sanktionsekalation

## Szenario-Titel

Schnelle Verbreitung netzwerkweiter Sanktionen.

## Lernziele

- Durchführung von Batch-Einfriervorgängen für mehrere Einheiten.
- Synchronisierung des internen Sanktionsspiegels (Sanctions Mirror).
- Überprüfung der Manifest-Verbreitung an die Teilnehmer.

## Voraussetzungen

- Der Operator besitzt die Rolle `ECB_ADMIN`.
- Zugriff auf das ECB Core Management Interface.
- Gültiger `ISSUING`-Schlüssel.

## System-Ausgangszustand

- Mehrere Ziel-Einheiten sind bei verschiedenen Teilnehmerbanken aktiv.
- System-Manifest-Version ist `v1.0.42`.

## Auslösendes Ereignis

Aktualisierung der konsolidierten Sanktionsliste durch den Europäischen Rat, die die sofortige Sperrung von über 50 zugehörigen Wallet-Adressen erfordert.

## Schritt-für-Schritt-Aktionen

1. **Batch-Vorbereitung**: Laden der bereitgestellten Datei `sanctions-list-2026-01-03.json` in das Batch-Verarbeitungsprogramm.
2. **Ausführung**: Ausführen des Batch-Einfrierskripts innerhalb des CSP.
3. **Spiegel-Synchronisierung**: Auslösen der Synchronisierung des internen `ecb-mirror`-Dienstes.
4. **Manifest-Broadcast**: Bestätigung der Erstellung des neuen `ecb-manifest.json`.
5. **Verifizierung**: Überprüfung, ob mindestens drei Teilnehmerknoten die neue Manifest-Version bestätigt haben.

## Erwartete Systemreaktionen

- Das Batch-Skript meldet eine Erfolgsquote von 100 % für alle Adressen.
- Der Hash von `ecb-manifest` wird aktualisiert und signiert.
- Teilnehmerknoten melden `MANIFEST_UPDATED` im Monitoring-Dashboard.

## Häufige Fehler

- Ausführen des Batch-Skripts in der falschen Umgebung (z. B. Lab statt Produktion).
- Versäumnis, die Spiegel-Synchronisierung auszulösen, was zu Transaktionsgenehmigungen in Grenzfällen führen kann.
- Ignorieren von Verzögerungen bei der Manifest-Verbreitung.

## Erzeugte Audit-Artefakte

- Log-Ereignis `SANCTIONS_ESCALATION`.
- Signierte `ecb-manifest.json` Version `v1.0.43`.
- Batch-Ausführungsbericht, gespeichert im Audit-Service.

## Abschlusskriterien

Alle Adressen in der Liste sind auf der Blockchain eingefroren, und das aktualisierte Manifest wurde erfolgreich im Netzwerk verbreitet.
