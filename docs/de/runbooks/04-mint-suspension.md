# Betriebshandbuch 04: Notfall-Emissionsaussetzung

## Zielsetzung

Globale Aussetzung der Erstellung neuer tEUR-Token zum Schutz der monetären Integrität des Systems während einer schwerwiegenden Sicherheitsverletzung, der Entdeckung einer Schwachstelle in einem Smart Contract oder extremer Marktinstabilität.

## Vorbedingungen

1. Erkennung einer unbefugten Emission oder einer Diskrepanz im Gesamtangebot.
2. Autorisierung durch den EZB-Rat (oder den delegierten Notfallausschuss).
3. Besitz des EZB-Schlüssels `ISSUING`.

## Ausführungsschritte

### 1. Globale Pause ausführen

Rufen Sie den System-Pause-Endpunkt auf. Dies nutzt das `Pausable`-Muster im `TokenizedEuro`-Vertrag.

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/system/pause" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

### 2. Globalen Status verifizieren

Bestätigen Sie, dass der Status `paused()` auf der Blockchain `true` ist.

```bash
teur-cli query is-paused
```

### 3. Teilnehmer benachrichtigen

Das System sendet automatisch einen `SYSTEM_PAUSED`-Alarm über die sichere Messaging-Ebene an alle verbundenen Banken und PSPs.

## Auswirkungen auf Settlement und Abstimmung

- **Settlement**: Alle neuen Transfers schlagen fehl. Ausstehende Transaktionen im Mempool werden abgelehnt.
- **Abstimmung (Reconciliation)**: Der Dienst `ecb-ingest` verfolgt weiterhin den letzten bekannten gültigen Status. Es werden keine neuen Angebotsänderungen aufgezeichnet.
- **Offline-Zahlungen**: Offline-Limits bleiben aktiv, können aber erst wieder aufgefüllt werden, wenn das System fortgesetzt wird.

## So nehmen Sie die Emission sicher wieder auf

1. **Ursachenanalyse**: Bestätigen Sie, dass die Schwachstelle behoben oder die Bedrohung neutralisiert wurde.
2. **Status-Integritätsprüfung**: Führen Sie das Tool `reconciliation-ref` aus, um sicherzustellen, dass das On-Chain-Angebot mit dem EZB-Hauptbuch übereinstimmt.
3. **Fortsetzen (Unpause)**:

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/system/unpause" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

## Fehlerbehandlung

- Wenn der `ISSUING`-Schlüssel kompromittiert ist, verwenden Sie zuerst den `Root`-Schlüssel, um den `ISSUING`-Schlüssel zu widerrufen (siehe Betriebshandbuch 05), und verwenden Sie dann einen sekundären `ISSUING`-Schlüssel, um die Pause zu aktivieren.

## Erzeugte Audit-Artefakte

- Protokollereignisse `SYSTEM_PAUSED` / `SYSTEM_UNPAUSED`.
- Blockchain-Ereignisse `Paused` / `Unpaused`.
- Signierter Autorisierungs-Blob, der im `AuditService` gespeichert ist.
