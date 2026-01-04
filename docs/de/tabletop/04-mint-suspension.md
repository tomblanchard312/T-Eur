# Tabletop-Übung 04: Notfall-Emissionsaussetzung (Mint Suspension)

## Übungsüberblick

### Ziel

Übung der globalen "Kill Switch"-Fähigkeit zur Aussetzung aller monetären Operationen (Minting und Transfers) als Reaktion auf eine systemische Bedrohung.

### Umfang

Aktivierung der globalen Pause, Kommunikation mit dem Eurosystem und die kontrollierte Wiederaufnahme des Betriebs.

### Teilnehmer und Rollen

- **Moderator**: Leitet das Krisenszenario.
- **EZB-Vorstand**: Autorisiert die globale Pause.
- **EZB-Admin**: Führt den technischen Pausenbefehl aus.
- **Kommunikationsleiter**: Verwaltet die Bekanntgabe an alle Teilnehmer.
- **Technischer Leiter**: Koordiniert die Schwachstellenbewertung.

### Dauer

120 Minuten.

### Annahmen

- Eine kritische Schwachstelle wurde identifiziert.
- Der `ISSUING`-Schlüssel ist gesichert und verfügbar.

## Szenario-Zeitplan

### T0: Ausgangsbedingungen

- Systemstatus: `ACTIVE`.
- Netzwerklast: Hoch.

### T+10: Inject 1 - Schwachstellenerkennung

**Inject**: Das Security Operations Center (SOC) erkennt einen Exploit in der `mint`-Funktion, der die Umgehung der EZB-Referenzdatenprüfung ermöglicht. Unbefugte tEUR werden generiert.

**Erwartete Teilnehmeraktionen**:

- Technischer Leiter bestätigt den Exploit.
- EZB-Vorstand beruft das Krisenmanagementteam ein.

### T+20: Inject 2 - Ausführung der Pause

**Inject**: Der EZB-Vorstand autorisiert eine globale Pause.

**Erwartete Teilnehmeraktionen**:

- EZB-Admin führt den Befehl `GLOBAL PAUSE` aus.
- Kommunikationsleiter sendet den Alarm `SYSTEM_PAUSED`.

**Erwartete Systemreaktionen**:

- Alle ausstehenden Transaktionen werden abgelehnt.
- `isPaused()` gibt `true` zurück.

### T+60: Inject 3 - Druck zur Wiederaufnahme

**Inject**: Große Geschäftsbanken melden, dass die Pause kritische Settlement-Flüsse stört. Sie fordern einen Zeitplan für die Wiederaufnahme.

**Erwartete Teilnehmeraktionen**:

- EZB-Vorstand wägt monetäre Sicherheit gegen Settlement-Stabilität ab.
- Technischer Leiter liefert ein Status-Update zum "Patch".

## Entscheidungspunkte

### Entscheidung 1: Schwellenwert für globale Pause

- **Frage**: Ist das unbefugte Minting bedeutend genug, um eine globale Pause zu rechtfertigen?
- **Zulässige Optionen**: Ja, jedes unbefugte Minting bedroht die Integrität des Euro.
- **Unzulässige Optionen**: Warten auf einen bestimmten Euro-Schwellenwert vor dem Handeln.
- **Konsequenzen**: Eine Verzögerung der Pause führt dazu, dass ungedeckte Währung in die Wirtschaft gelangt.

### Entscheidung 2: Kriterien für die Wiederaufnahme

- **Frage**: Was muss vor der Aufhebung der Pause verifiziert werden?
- **Zulässige Optionen**: Vollständige Abstimmung der Gesamtumlaufmenge und ein verifizierter Patch.
- **Unzulässige Optionen**: Wiederaufnahme basierend auf verstrichener Zeit oder Druck der Teilnehmer.
- **Konsequenzen**: Eine vorzeitige Wiederaufnahme kann dazu führen, dass der Exploit fortgesetzt wird.

## Evaluationskriterien

- **Technische Korrektheit**: Erfolgreiche Ausführung der Pausen- und Wiederaufnahmebefehle.
- **Verfahrenstreue**: Vorstandsautorisierung vor der technischen Ausführung eingeholt.
- **Audit-Vollständigkeit**: Ereignisse `SYSTEM_PAUSED` und `SYSTEM_RESUMED` protokolliert.
- **Kommunikationsklarheit**: Rechtzeitige und genaue Alarme an das Teilnehmernetzwerk.

## Nachbesprechungs-Checkliste

- [ ] Wie lange dauerte es von der Erkennung bis zur Pause?
- [ ] Wurde der Begründungstext "Eindämmung kritischer Schwachstellen" verwendet?
- [ ] Haben alle Teilnehmerknoten den Pausenalarm erhalten?
- [ ] **Gesammelte Beweise**: Blockchain-Ereignis `Paused`, signierter Autorisierungs-Blob.
- [ ] **Folgemaßnahmen**: Überprüfung der Sicherheitsprotokolle für die "Notfall-Wiederaufnahme".
