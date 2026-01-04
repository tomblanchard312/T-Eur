# Audit-Nachweis: UI-Nicht-Umgehbarkeit und Backend-Autorität

## 1. Einleitung

Dieses Dokument liefert verifizierbare Nachweise dafür, dass die **tEUR EZB-Operator-Schnittstelle** eine nicht-autoritative Präsentationsebene ist. Die gesamte hoheitliche Autorität, Sicherheitsdurchsetzung und Richtlinienvalidierung liegt ausschließlich im Backend der **Geschlossenen Abwicklungsebene (GAE)**.

## 2. Nachweis 1: RBAC-Durchsetzung (Backend-Autorität)

**Kontrolle**: Das Backend validiert die mit dem mTLS-Zertifikat verknüpfte Rolle für jede Anfrage, unabhängig vom Status der Benutzeroberfläche (UI).

### Testfall: Zugriff auf nicht autorisierten Endpunkt

- **Akteur**: Auditor (Rolle: `AUDITOR`)
- **Aktion**: Direkter API-Aufruf an `/v1/ecb/mint` (unter Umgehung der UI)
- **Befehl**:
  ```bash
  curl -X POST https://csp.teur.internal/v1/ecb/mint \
    --cert auditor.crt --key auditor.key \
    -H "Content-Type: application/json" \
    -d '{"amount": "1000", "justification": "Nicht autorisierter Versuch"}'
  ```
- **Erwartetes Ergebnis**:
  - **HTTP-Status**: `403 Forbidden`
  - **Fehlercode**: `RBAC_FAILURE`
  - **Audit-Ereignis**: `action_rejected` wird mit Akteur `AUD001` und Grund `Unzureichende Berechtigungen` ausgegeben.

---

## 3. Nachweis 2: Integrität der Rolle-mTLS-Bindung

**Kontrolle**: Das Backend weist Anfragen ab, bei denen die Identität des Zertifikats nicht mit der für die angeforderte Aktion erforderlichen Rolle übereinstimmt.

### Testfall: Rollen-Inkonsistenz

- **Szenario**: Ein für einen `PARTICIPANT` gültiges Zertifikat wird verwendet, um einen Endpunkt aufzurufen, der für einen `ECB_OPERATOR` reserviert ist.
- **Erwartetes Ergebnis**:
  - **HTTP-Status**: `403 Forbidden`
  - **Fehlercode**: `UNAUTHORIZED_ROLE`
  - **Nachweis**: Backend-Protokolle zeigen: `Rolle PARTICIPANT wird in der GAE für Pfad /v1/ecb/mint nicht anerkannt`.

---

## 4. Nachweis 3: Obligatorische Begründung und Richtlinie

**Kontrolle**: Das Backend erzwingt das Vorhandensein einer Begründung (Justification) für alle hoheitlichen Aktionen.

### Testfall: Fehlende Begründung

- **Aktion**: EZB-Operator ruft `/v1/ecb/mint` ohne das Feld `justification` auf.
- **Erwartetes Ergebnis**:
  - **HTTP-Status**: `400 Bad Request`
  - **Fehlercode**: `VALIDATION_FAILED`
  - **Details**: `path: justification, message: Required`
  - **Audit-Ereignis**: Es wird kein `action_executed`-Ereignis ausgegeben; die Transaktion wird niemals an die Blockchain gesendet.

---

## 5. Nachweis 4: Nicht-autoritatives UI-Rendering

**Kontrolle**: Die UI zeigt Aktionen basierend auf der Antwort von `/v1/operator/me` an, aber das Backend bleibt der endgültige Validator.

### Beweiserhebung

1. **Schritt**: Browser-DOM manipulieren, um die Schaltfläche "Emittieren" (Mint) für einen Auditor anzuzeigen.
2. **Schritt**: Auf die Schaltfläche klicken und eine Anfrage senden.
3. **Ergebnis**: Das Backend gibt `403 Forbidden` zurück.
4. **Fazit**: Die UI-Sichtbarkeit ist eine Komfortfunktion; die Backend-Durchsetzung ist die Sicherheitsgrenze.

---

## 6. Nachweis 5: Vollständigkeit der Audit-Ereignisse und Korrelation

**Kontrolle**: Jede hoheitliche Aktion ist systemübergreifend über eine eindeutige Korrelations-ID verknüpft.

### Beweis-Artefakt

| Artefakt              | Ort             | Wert                                               |
| :-------------------- | :-------------- | :------------------------------------------------- |
| **Anfrage-Header**    | UI-Ausgabe      | `X-Correlation-Id: 550e...`                        |
| **Backend-Protokoll** | GAE-Dienst      | `Verarbeitung MINT für Correlation-Id: 550e...`    |
| **Audit-Speicher**    | Audit-Datenbank | `Ereignis: MINT_EXECUTED, Correlation-Id: 550e...` |

---

## 7. Nachweis 6: Integrität des Beweismittelpakets

**Kontrolle**: Exportierte Beweismittelpakete sind durch ein kryptografisches Manifest geschützt.

### Validierungsschritte

1. **Export**: Paket über `POST /v1/ecb/audit/export` generieren.
2. **Inspektion**: `evidence_20260103.zip` öffnen.
3. **Verifizierung**:
   - `manifest.json` enthält SHA-256-Hashes aller enthaltenen Audit-Protokolle.
   - `signature.asc` liefert den Herkunftsnachweis vom GAE-Sicherheitsmodul.
4. **Befehl**:
   ```bash
   sha256sum -c manifest.json
   ```
   **Erwartetes Ergebnis**: `audit_log_01.json: OK`

---

## 8. Fazit

Diese Nachweise belegen, dass das tEUR-System dem **Prinzip der geringsten Privilegien** und der **abgestuften Verteidigung** (Defense in Depth) folgt. Die UI kann nicht dazu verwendet werden, die strengen monetären und sicherheitstechnischen Kontrollen zu umgehen, die von der EZB innerhalb der Geschlossenen Abwicklungsebene durchgesetzt werden.
