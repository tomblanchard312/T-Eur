# Betriebshandbuch 01: Notfall-Einfrieren von Wallet/Konto

## Zielsetzung

Sofortiges Stoppen aller ausgehenden Transfervorgänge von einer bestimmten Wallet-Adresse oder einem Unternehmenskonto, um unbefugte Geldbewegungen zu verhindern, die Einhaltung regulatorischer Vorschriften zu gewährleisten oder auf einen Sicherheitsvorfall zu reagieren.

## Vorbedingungen

1. Der Bediener muss über einen API-Schlüssel oder ein JWT mit der Rolle `ECB_ADMIN` verfügen.
2. Der verwendete Schlüssel muss in der souveränen Schlüsselhierarchie mit der Rolle `ISSUING` registriert sein.
3. Die Ziel-Wallet-Adresse muss eine gültige Ethereum-kompatible Adresse (0x...) sein.

## Autorisierungsanforderungen

- **Standard-Einfrieren**: Erfordert eine einfache Autorisierung durch einen operativen Mitarbeiter der EZB/NZB.
- **Hochwert-Einfrieren (> 1.000.000 €)**: Erfordert eine Doppelautorisierung (Vier-Augen-Prinzip) gemäß Regelwerk Abschnitt 4.2.

## Ausführungsschritte

### 1. Ziel identifizieren

Bestätigen Sie die Zieladresse und die Rechtsgrundlage für das Einfrieren (z. B. Sanktionsliste, Betrugswarnung).

### 2. Einfrieren über API ausführen

Senden Sie eine POST-Anfrage an den Transfer-Service:

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/freeze" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -H "Content-Type: application/json" \
     -d '{
       "account": "0xTargetAddress...",
       "reason": "Notfall-Sanktions-Compliance - Fall-ID: 2026-001"
     }'
```

### 3. Blockchain-Bestätigung überwachen

Warten Sie, bis die Transaktion im Besu-Netzwerk gemined wurde. Rufen Sie den Transaktions-Hash aus der API-Antwort ab.

## Validierungsprüfungen

1. **On-Chain-Verifizierung**:
   Fragen Sie den Vertragsstatus ab, um zu bestätigen, dass das Flag `frozen` auf `true` gesetzt ist:
   ```bash
   # Verwendung des internen CLI-Tools
   teur-cli query is-frozen 0xTargetAddress...
   ```
2. **Test-Transfer versuchen**:
   Versuchen Sie einen kleinen Transfer vom eingefrorenen Konto. Die Transaktion MUSS mit dem Fehler `AccountIsFrozen` fehlschlagen.

## Fehlerbehandlung

- **Transaktion abgebrochen**: Wenn die Transaktion fehlschlägt, überprüfen Sie die `GovernanceService`-Protokolle auf `KEY_VALIDATION_FAILED`. Stellen Sie sicher, dass der Schlüssel nicht widerrufen wurde.
- **Netzwerkpartition**: Wenn der Besu-Knoten nicht erreichbar ist, wechseln Sie zum sekundären Validator-Knoten im geschlossenen Settlement-Plane (CSP).

## Rücknahme / Aufheben des Einfrierens

1. Überprüfen Sie die rechtliche Klärung des Einfrierens.
2. Führen Sie den Befehl zum Aufheben des Einfrierens aus:

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/unfreeze" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -d '{ "account": "0xTargetAddress..." }'
```

## Erzeugte Audit-Beweise

- **API-Protokolle**: Ereignis `ACCOUNT_FROZEN` im strukturierten JSON-Format.
- **Blockchain-Ereignis**: `AccountFrozen(address indexed account)`, emittiert vom `TokenizedEuro`-Vertrag.
- **Governance-Protokoll**: Aufzeichnung des für den Vorgang verwendeten `ISSUING`-Schlüssels.
