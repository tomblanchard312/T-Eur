# Betriebshandbuch 03: Notfall-Treuhandplatzierung

## Zielsetzung

Isolierung umstrittener oder verdächtiger Gelder durch Übertragung auf ein systemgesteuertes Treuhandkonto. Dies wird angewendet, wenn ein vollständiges Einfrieren des Kontos als unverhältnismäßig erachtet wird oder wenn Gelder bis zu einer gerichtlichen Entscheidung einbehalten werden müssen.

## Wann Treuhand statt Einfrieren verwendet wird

- **Umstrittene Transaktionen**: Wenn ein Transfer als potenziell betrügerisch markiert wird, der Kontoinhaber jedoch noch nicht als böswilliger Akteur verifiziert wurde.
- **Clawback-Operationen**: Vorübergehende Verwahrung von Geldern während eines Rückbuchungsprozesses.
- **Gerichtliche Anordnungen**: Spezifische Anforderungen zur Bereitstellung eines festen Betrags, während das Konto für andere Gelder betriebsbereit bleiben kann.

## Ausführungsschritte

### 1. Treuhandbetrag berechnen

Bestimmen Sie den genauen Betrag in Euro-Cent (2 Dezimalstellen), der übertragen werden soll.

### 2. Treuhand über API ausführen

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/escrow" \
     -H "X-API-KEY: [OPERATIONAL_KEY]" \
     -d '{
       "from": "0xSourceAddress...",
       "amount": 500000,
       "reason": "Laufende Betrugsuntersuchung - Fall #998",
       "expiresAt": 1735948800
     }'
```

### 3. Übertragung verifizieren

Bestätigen Sie, dass das Guthaben der Quelle abgenommen hat und das Guthaben des `Escrow`-Vertrags für diese `escrowId` zugenommen hat.

## Blockierte Operationen

- **Quellkonto**: Kann den treuhänderisch hinterlegten Teil des Guthabens nicht übertragen.
- **Treuhänderisch hinterlegte Gelder**: Können von keiner Partei außer der EZB/NZB vernichtet, übertragen oder für Zahlungen verwendet werden.

## Handhabung des Ablaufs

- Wenn `expiresAt` ohne manuelles Eingreifen erreicht wird, verbleiben die Gelder auf dem Treuhandkonto, lösen jedoch einen `MANUAL_REVIEW_REQUIRED`-Alarm im `AuditService` aus.
- Eine automatische Freigabe ist für Notfall-Treuhandkonten VERBOTEN.

## Anforderungen an die manuelle Überprüfung

- Wöchentliche Prüfung aller aktiven Treuhandkonten durch den Compliance-Beauftragten.
- Die Begründung für eine Verlängerung muss im `AuditService` aufgezeichnet werden.

## Validierungsprüfungen

- Überprüfen Sie `getEscrowBalance(escrowId)` on-chain.
- Verifizieren Sie das Ereignis `FUNDS_ESCROWED` in den API-Protokollen.

## Erzeugte Audit-Artefakte

- Protokollereignis `FUNDS_ESCROWED`.
- Blockchain-Ereignis `Transfer` an die Adresse des Treuhandvertrags.
- Eintrag im Audit-Trail des `GovernanceService`, der die Aktion mit dem `OPERATIONAL`-Schlüssel verknüpft.
