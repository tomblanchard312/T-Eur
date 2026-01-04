# Betriebshandbuch 05: Notfallreaktion bei Schlüsselkompromittierung

## Zielsetzung

Erkennung, Eindämmung und Behebung der Kompromittierung eines kryptografischen Schlüssels innerhalb der souveränen Schlüsselhierarchie, um unbefugte monetäre Aktionen zu verhindern.

## Erkennungsauslöser

- **Unbefugte Aktion**: Ein `TOKENS_MINTED`- oder `SYSTEM_PAUSED`-Ereignis, das nicht mit einer gültigen internen Änderungsanforderung verknüpft ist.
- **Governance-Alarm**: Spitzenwerte von `KEY_VALIDATION_FAILED` in den Protokollen.
- **Physische Verletzung**: Gemeldete Kompromittierung eines HSM oder einer sicheren Enklave.

## Sofortige Eindämmungsmaßnahmen

### 1. Kompromittierten Schlüssel widerrufen

Widerrufen Sie den Schlüssel sofort mit dem `ISSUING`- oder `ROOT`-Schlüssel:

```bash
curl -X POST "https://[internal-gateway]/api/v1/governance/keys/[COMPROMISED_KEY_ID]/revoke" \
     -H "X-API-KEY: [ROOT_OR_ISSUING_KEY]" \
     -d '{ "reason": "Confirmed Key Compromise - Incident #2026-05" }'
```

### 2. Globaler Stopp (Falls der Schlüssel ISSUING/OPERATIONAL war)

Wenn der kompromittierte Schlüssel über Emissions- oder Administrationsrechte verfügte, führen Sie sofort das Betriebshandbuch 04 (Notfall-Emissionsaussetzung) aus.

## Isolierung von Teilnehmern

- Wenn der Schlüssel eines Teilnehmers (Bank) kompromittiert ist, widerruft die EZB alle mit dieser `ownerId` verknüpften Schlüssel.
- Der Gateway-Zugang des Teilnehmers wird auf Firewall-Ebene im CSP blockiert.

## Schritte zur Systemwiederherstellung

### 1. Schlüsselrotation

Generieren Sie neue Schlüssel für die betroffene Einheit und registrieren Sie diese über den `GovernanceService`.

```bash
curl -X POST "https://[internal-gateway]/api/v1/governance/keys" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -d '{
       "keyId": "new-bank-key-01",
       "publicKey": "0xNewPubKey...",
       "role": "PARTICIPANT",
       "ownerId": "bank-de-01"
     }'
```

### 2. Überprüfung des Audit-Trails

Überprüfen Sie alle Transaktionen, die seit dem geschätzten Zeitpunkt der Kompromittierung mit dem kompromittierten Schlüssel signiert wurden. Identifizieren Sie alle "vergifteten" Transaktionen für eine Rückabwicklung oder Treuhandverwahrung.

### 3. Wiederherstellung des Dienstes

Sobald die Umgebung als sauber verifiziert wurde, heben Sie den Systemstopp auf (falls aktiviert).

## Validierungsprüfungen

- Bestätigen Sie, dass die kompromittierte `keyId` im `GovernanceService` den `status: 'REVOKED'` zurückgibt.
- Überprüfen Sie, ob jeder Versuch, den alten Schlüssel zu verwenden, zu einem sofortigen `403 Forbidden` mit dem Protokollereignis `KEY_REVOKED` führt.

## Generierte Audit-Artefakte

- Protokollereignis `KEY_REVOKED`.
- Protokollereignis `KEY_REGISTERED` für den Ersatz.
- Vorfallsbericht mit dem Zeitplan der Erkennung und des Widerrufs.
