# Interaktionsabläufe zwischen EZB-Benutzeroberfläche und Backend

## 1. Überblick

Dieses Dokument beschreibt die End-to-End-Interaktionsabläufe zwischen dem **EZB-Operator-Dashboard** (Frontend) und der **Steuerungsebene der Geschlossenen Abwicklungsebene (CSP)** (Backend).

### Vertrauensgrenze

Die **Benutzeroberfläche (UI) ist nicht autoritativ**. Alle Sicherheitsmaßnahmen, Rollenvalidierungen (RBAC) und Richtlinienprüfungen werden vom Backend durchgeführt. Die UI dient als sichere Präsentationsebene für hoheitliche Maßnahmen, die ein menschliches Eingreifen erfordern.

---

## 2. Ablauf 1: Operator-Erkennung & Berechtigungszuordnung

**Ziel**: Sicherstellen, dass der Operator nur Aktionen sieht, zu deren Durchführung er berechtigt ist.

### Sequenz

1. **UI** -> `GET /v1/operator/me` (Authentifiziert über mTLS)
2. **Backend** validiert das Client-Zertifikat und die Rolle.
3. **Backend** gibt Identität, Rolle und Berechtigungs-Flags zurück.
4. **UI** rendert die Seitenleiste und Aktionsschaltflächen basierend auf den `capabilities`.

### Beispiel

**Anfrage**:

```http
GET /v1/operator/me
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000
```

**Antwort (200 OK)**:

```json
{
  "identity": {
    "id": "OP-01",
    "role": "ECB_OPERATOR",
    "cn": "OP-01:ECB_OPERATOR:JohnDoe"
  },
  "capabilities": {
    "canMint": true,
    "canAudit": true,
    "canManageKeys": false
  }
}
```

---

## 3. Ablauf 2: tEUR-Emission (Hoheitliche Schöpfung)

**Ziel**: Emission neuer tEUR-Token im System.

### Sequenz

1. **Operator** gibt Betrag und Begründung in der UI ein.
2. **UI** zeigt **Bestätigungsdialog** an (Pflichtfeld).
3. **UI** -> `POST /v1/ecb/mint` (Enthält `X-Request-Id` für Idempotenz).
4. **Backend** validiert:
   - Rolle ist `ECB_OPERATOR`.
   - Begründung ist vorhanden und valide.
   - Die Emission ist nicht global ausgesetzt.
5. **Backend** erzeugt die Audit-Ereignisse `action_requested` und `action_executed`.
6. **UI** zeigt Erfolgsmeldung und Audit-Referenz an.

### Beispiel

**Anfrage**:

```json
{
  "amount": "100000000",
  "targetAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "justification": "Quartalsweise Liquiditätsanpassung gemäß Ratsbeschluss 2025/88"
}
```

**Audit-Ereignisse**:

- `MINT_REQUESTED`: Wird sofort nach Erhalt protokolliert.
- `MINT_EXECUTED`: Wird nach erfolgreicher Blockchain-Bestätigung protokolliert.

---

## 4. Ablauf 3: tEUR-Vernichtung (Hoheitlicher Rückkauf)

**Ziel**: Entfernen von tEUR-Token aus dem Umlauf.

### Sequenz

1. **Operator** gibt Betrag und Begründung ein.
2. **UI** zeigt **Warnung vor irreversibler Aktion** an.
3. **UI** -> `POST /v1/ecb/burn`.
4. **Backend** validiert Rolle und Begründung.
5. **Backend** führt die Vernichtung aus und erzeugt Audit-Ereignisse.

---

## 5. Ablauf 4: Einfrieren einer Einheit (Durchsetzung von Sanktionen)

**Ziel**: Sperren einer bestimmten Wallet-Adresse für Überweisungen.

### Sequenz

1. **Operator** sucht nach der Adresse in der UI.
2. **Operator** gibt die **Rechtsgrundlage** und Begründung ein.
3. **UI** -> `POST /v1/ecb/sanctions/freeze`.
4. **Backend** aktualisiert das Sanktionsregister auf der Chain.
5. **Backend** erzeugt das Audit-Ereignis `SANCTION_FREEZE`.

---

## 6. Ablauf 5: Treuhand-Hinterlegung (Escrow)

**Ziel**: Sperren von Geldern aus rechtlichen oder Compliance-Gründen.

### Sequenz

1. **Operator** gibt Adresse, Betrag und Ablaufregeln ein.
2. **UI** -> `POST /v1/ecb/escrow/place`.
3. **Backend** gibt eine `escrow_id` zurück.
4. **UI** zeigt die Hinterlegung in der Tabelle "Aktive Treuhandkonten" an.

---

## 7. Ablauf 6: Schlüsselrotation

**Ziel**: Rotation von HSM-gestützten hoheitlichen Schlüsseln.

### Sequenz

1. **Operator** (Systemadministrator) wählt den Schlüssel in der UI aus.
2. **UI** -> `POST /v1/ecb/keys/rotate`.
3. **Backend** löst die HSM-Rotation aus und gibt die neue Schlüsselversion zurück.
4. **UI** zeigt "Rotation erfolgreich" mit Zeitstempel an.

---

## 8. Ablauf 7: Nachweis-Export

**Ziel**: Erstellung eines signierten Pakets von Audit-Ereignissen für Regulierungsbehörden.

### Sequenz

1. **Auditor** wendet Filter (Datum, Akteur, Aktion) in der UI an.
2. **UI** -> `POST /v1/ecb/audit/export`.
3. **Backend** erstellt ein ZIP-Paket mit JSON-Ereignissen und einem SHA-256-Manifest.
4. **Backend** gibt eine Download-Referenz zurück.
5. **UI** löst den Browser-Download aus.

---

## 9. Fehlerfälle & Fehlermeldungen

| Szenario                  | Fehlercode          | HTTP-Status | UI-Verhalten                                               |
| :------------------------ | :------------------ | :---------- | :--------------------------------------------------------- |
| **Ungültiges Zertifikat** | `MTLS_REQUIRED`     | 401         | Weiterleitung zur Seite "Zugriff verweigert".              |
| **Unzureichende Rolle**   | `FORBIDDEN`         | 403         | Anzeige der Warnung "Nicht autorisierte Aktion".           |
| **Fehlende Begründung**   | `VALIDATION_FAILED` | 400         | Markierung des Begründungsfeldes in Rot.                   |
| **Doppelte Anfrage**      | `IDEMPOTENCY_HIT`   | 200         | Anzeige des vorherigen Ergebnisses (keine Doppelemission). |
| **System ausgesetzt**     | `MINTING_SUSPENDED` | 400         | Anzeige des Banners "Globale Aussetzung aktiv".            |
