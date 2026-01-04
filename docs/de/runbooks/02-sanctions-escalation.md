# Betriebshandbuch 02: Notfall-Sanktionseskalation

## Zielsetzung

Schnelle Verbreitung von sanktionsbezogenen Beschränkungen im gesamten tEUR-Netzwerk, um sicherzustellen, dass alle Teilnehmer (Banken, PSPs) Transaktionen mit sanktionierten Einheiten sofort blockieren.

## Vorbedingungen

1. Offizielle Benachrichtigung durch den Europäischen Rat oder die zuständige Rechtsbehörde.
2. Zugriff auf die EZB-Kernverwaltungsschnittstelle innerhalb des geschlossenen Settlement-Plane (CSP).

## Regeln zur Erweiterung des Geltungsbereichs

- **Individuell**: Einfrieren spezifischer Wallet-Adressen.
- **Einheit**: Einfrieren aller Wallets, die einer Teilnehmer-ID zugeordnet sind.
- **Jurisdiktionell**: (Falls zutreffend) Aussetzen aller Operationen für eine bestimmte Zone.

## Ausführungsschritte

### 1. Batch-Einfrieren ausführen

Verwenden Sie für mehrere Adressen das Batch-Verarbeitungsprogramm, um die Latenz zu minimieren:

```bash
# Internes Skript für Batch-Sanktionen
node api/bin/batch-freeze.js --file sanctions-list-2026-01-03.json
```

### 2. Lokalen Sanktionsspiegel aktualisieren

Aktualisieren Sie den internen `ecb-mirror`-Dienst, um sicherzustellen, dass das API-Gateway Transaktionen bereits am Rand ablehnt, bevor sie die Blockchain erreichen:

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/sanctions/sync" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

### 3. Sanktionsmanifest verbreiten

Das System generiert automatisch ein neues `ecb-manifest`, das die aktualisierten eingefrorenen Konten enthält. Dieses Manifest wird von allen Teilnehmerknoten innerhalb von 60 Sekunden abgerufen.

## Verbreitungsgarantien

- **Blockchain-Status**: Sobald die `freeze`-Transaktion bestätigt ist, ist die Beschränkung absolut und wird von jedem Knoten im Netzwerk erzwungen.
- **Latenz**: Die maximale Verbreitungsverzögerung ist definiert als `Blockzeit (2s) + Synchronisationszeit (5s) = 7s`.

## Sichtbarkeitsgarantien für Regulierungsbehörden

- Regulierungsbehörden haben Lesezugriff auf die Ereignisse des `TokenizedEuro`-Vertrags.
- Der `AuditService` bietet über den Endpunkt `/api/v1/audit/stream` einen Echtzeit-Stream von `ACCOUNT_FROZEN`-Ereignissen an.

## Erfassung rechtlicher Referenzen

Jeder Einfriervorgang MUSS ein Feld `reason` enthalten, das Folgendes umfasst:

- Referenz des Rechtsinstruments (z. B. EU-Verordnung 2024/XXX).
- Fall-ID.
- Zeitstempel der rechtlichen Anordnung.

## Validierungsprüfungen

- Überprüfen Sie, ob der Hash von `ecb-manifest` aktualisiert und mit dem `ISSUING`-Schlüssel signiert wurde.
- Bestätigen Sie, dass die Teilnehmerknoten die Aktualisierung des Manifests bestätigt haben.

## Erzeugte Audit-Artefakte

- Signiertes `ecb-manifest.json`.
- `logAuditEvent`-Einträge mit `action: 'SANCTIONS_ESCALATION'`.
- Blockchain-Transaktionsbelege für alle eingefrorenen Adressen.
