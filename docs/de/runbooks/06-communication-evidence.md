# Betriebshandbuch 06: Kommunikation und Beweissicherung

## Zielsetzung

Standardisierung der Erfassung, Aufbewahrung und Berichterstattung von Beweismitteln während und nach einer monetären Notfallmaßnahme, um die rechtliche Verteidigbarkeit und regulatorische Transparenz zu gewährleisten.

## Automatisch erfasste Beweismittel

### 1. API-Audit-Protokolle

Der `AuditService` erfasst jede Anfrage an den Namensraum `/api/v1`, einschließlich:

- `X-Request-Id` (Korrelation).
- `X-API-KEY` (Akteursidentifikation - maskiert).
- Anfrage-Payload und Antwortstatus.
- Zeitstempel (UTC).

### 2. Governance-Protokolle

Der `GovernanceService` zeichnet auf:

- Ergebnisse der Schlüsselrollen-Validierung.
- Widerrufsgründe.
- Pfade der Hierarchie-Traversierung.

### 3. Blockchain-Status

Das Besu-Netzwerk bietet eine unveränderliche Aufzeichnung von:

- Transaktions-Hashes.
- Ausgelösten Ereignissen (`Transfer`, `AccountFrozen`, `Paused`).
- Block-Headern und Zeitstempeln.

## Manuell zu sichernde Beweismittel

### 1. Autorisierungsdokumente

- Signierte PDF- oder physische Dokumente des EZB-Rat, die die Notfallmaßnahme autorisieren.
- E-Mails oder sichere Nachrichten, die die Reaktion auf den Vorfall einleiten.

### 2. Externe Informationen

- Screenshots oder Exporte von externen Sanktionsanbietern (z. B. UN, OFAC).
- Betrugsmeldungen von Geschäftsbanken.

### 3. Zeitplan des Vorfalls

- Ein manuelles Protokoll aller mündlichen Entscheidungen und systemfremden Maßnahmen, die während der "Goldenen Stunde" des Vorfalls getroffen wurden.

## Für Audits aufbewahrte Artefakte

Alle Artefakte müssen gemäß den DORA/ISO 27001-Anforderungen mindestens 10 Jahre lang aufbewahrt werden:

- **JSONL-Protokolle**: Tägliche Exporte der `AuditService`-Protokolle.
- **Manifest-Snapshots**: Die `ecb-manifest.json` zum Zeitpunkt des Vorfalls.
- **Datenbank-Backups**: Verschlüsselte Snapshots des internen Status des API-Gateways.

## Kommunikationsprotokoll

1. **Intern**: Sofortige Benachrichtigung des EZB-CISO und des Leiters der Marktinfrastruktur.
2. **Teilnehmer**: Bekanntgabe über die Ereignistypen `SYSTEM_PAUSED` oder `SECURITY_ALERT`.
3. **Regulierungsbehörden**: Formaler Bericht, der innerhalb von 24 Stunden über das sichere Regulierungsportal eingereicht wird.
4. **Öffentlichkeit**: (Falls erforderlich) Offizielle Erklärung über die EZB-Website. Es dürfen keine technischen Details (Schlüssel, Adressen) öffentlich geteilt werden.

## Validierungsprüfungen

- Bestätigen Sie, dass das `logAuditEvent` für die Notfallmaßnahme eine gültige `correlationId` enthält.
- Überprüfen Sie, ob das Beweispaket kryptografisch gehasht wurde und der Hash im `AuditService` aufgezeichnet ist.

## Generierte Audit-Artefakte

- Protokollereignis `SECURITY_ALERT`.
- `MANIFEST_DIAGNOSTICS_WRITTEN` (falls Integritätsprobleme festgestellt wurden).
- Abschlussbericht zum Vorfall.
