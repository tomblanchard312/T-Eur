# tEUR-Bereitstellungsanleitung

Diese Anleitung erklärt, wie die tEUR-Plattform mithilfe des einheitlichen Bereitstellungssystems bereitgestellt wird.

## Überblick

Die tEUR-Plattform unterstützt die Bereitstellung in mehreren Umgebungen mit verschiedenen Rollen. Das Bereitstellungssystem bietet eine einzige Befehlszeilenschnittstelle, die auf Linux, Windows und CI/CD-Pipelines funktioniert.

## Umgebungen

- **local**: Lokale Entwicklung mit Docker Compose
- **lab**: Testumgebung
- **test**: Integrationstests
- **pilot**: Vorproduktion
- **prod**: Produktion

## Rollen

- **central-bank**: Kernabrechnungsinfrastruktur
- **state-bank**: Staatsbankoperationen
- **local-bank**: Lokale Bankoperationen
- **psp**: Zahlungsdienstleister
- **merchant-simulator**: Nur lokaler Test

## Voraussetzungen

- Docker und Docker Compose
- Für nicht-lokal: Terraform, kubectl, Cloud-CLI (falls zutreffend)
- Schlüsselmaterial (siehe Schlüsselverwaltung)

## Lokale Bereitstellung

Für die lokale Entwicklung:

```bash
./deploy/deploy.sh --env local --role psp
```

Oder auf Windows:

```powershell
.\deploy\deploy.ps1 -Env local -Role psp
```

Dies startet alle Dienste mit Docker Compose.

## Cloud/interne Bereitstellung

Für Cloud- oder interne Bereitstellungen:

```bash
./deploy/deploy.sh --env prod --role central-bank --confirm-prod
```

### Schlüsselverwaltung

Schlüssel müssen über folgende Wege bereitgestellt werden:

1. Umgebungsvariablen:

   ```bash
   export TEUR_ROOT_CA_KEY="..."
   export TEUR_ISSUER_KEY="..."
   export TEUR_ACQUIRER_KEY="..."
   export TEUR_PSP_KEY="..."
   ```

2. Dateien im `keys/`-Verzeichnis:
   - `keys/TEUR_ROOT_CA_KEY.pem`
   - usw.

Für die Produktion niemals Testschlüssel verwenden.

### CI/CD-Bereitstellung

Verwenden Sie den GitHub Actions-Workflow mit manuellem Dispatch.

Wählen Sie Umgebung, Rolle und bestätigen Sie für prod.

Geheimnisse werden aus GitHub-Geheimnissen injiziert.

## Architektur

- **Terraform**: Infrastructure as Code für Cloud-Ressourcen
- **Kubernetes**: Container-Orchestrierung mit Helm-Charts
- **Netzwerkrichtlinien**: Erzwingen CSP-Isolierung
- **mTLS**: Erforderlich im geschlossenen Abrechnungsplan

## Verzeichnisstruktur

```
deploy/
├── deploy.sh              # Linux/Mac-Bereitstellungsskript
├── deploy.ps1             # Windows-Bereitstellungsskript
├── terraform/
│   ├── modules/           # Wiederverwendbare Terraform-Module
│   └── environments/      # Umgebungsspezifische Konfigurationen
├── kubernetes/
│   └── charts/            # Helm-Charts für Dienste
├── scripts/
│   ├── validate.sh        # Vorab-Bereitstellungsvalidierung
│   └── bootstrap.sh       # Erstkonfiguration
└── docs/
    └── README.md          # Diese Datei
```

## Sicherheitsfunktionen

- Explizite Umgebungs- und Rollenselektion
- Schlüsselvalidierung vor der Bereitstellung
- Prod-Bestätigung erforderlich
- Keine interaktiven Eingabeaufforderungen in CI
- Deterministisches Verhalten
- CSP verwendet niemals öffentliches DNS

## Fehlerbehebung

- Überprüfen Sie Tool-Versionen mit `validate.sh`
- Überprüfen Sie Terraform-Pläne
- Überprüfen Sie Kubernetes-Logs
- Stellen Sie sicher, dass Schlüssel korrekt injiziert werden
