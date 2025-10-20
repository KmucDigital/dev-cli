# KMUC Dev CLI - Website

Modern Vercel-inspired website für KMUC Dev CLI mit dynamischer Versionsverwaltung.

## Features

- ✨ **Dynamische Versionsnummern** - Keine hardcoded versions, alles wird aus `package.json` geladen
- 🎨 **Vercel-Design** - Minimalistisches, modernes Design
- 📱 **Responsive** - Mobile, Tablet, Desktop optimiert
- 🔍 **Suchfunktion** - In der help.html Dokumentation
- 📋 **Copy-to-Clipboard** - Für alle Code-Snippets
- 🚀 **Zero Dependencies** - Pure HTML/CSS/JavaScript

## Struktur

```
webapp/
├── index.html          # Landing Page
├── dokumentation.html  # Vollständige Dokumentation
├── styles.css          # Shared Design System (Vercel-Style)
├── server.js           # Dev Server mit Version Injection
└── README.md           # Diese Datei
```

## Development

Starte den Development Server:

```bash
npm run webapp
# oder
node webapp/server.js
```

Der Server läuft auf `http://localhost:3000` und injiziert automatisch die aktuelle Version aus `package.json` in alle HTML-Dateien.

## Versionsverwaltung

Alle Versionsnummern werden **dynamisch** geladen:

### 1. Help Command (`kmuc help`)
Die `help.html` verwendet `src/utils/version.js` um die Version zu injizieren.

### 2. Webapp
Der `webapp/server.js` nutzt ebenfalls `src/utils/version.js` für Version Injection.

### 3. CLI
Das CLI in `bin/cli.js` liest die Version direkt aus `package.json`.

## Version aktualisieren

Um die Version zu aktualisieren, ändere nur die Versionsnummer in `package.json`:

```json
{
  "version": "2.3.0"
}
```

Die neue Version wird **automatisch** überall verwendet:
- ✅ CLI (`kmuc --version`)
- ✅ Help Command (`kmuc help`)
- ✅ Website (index.html)
- ✅ Dokumentation (dokumentation.html)

## Docker Deployment

### Mit Docker Compose (Empfohlen)

```bash
# Im webapp Verzeichnis
cd webapp

# Container bauen und starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Container stoppen
docker-compose down
```

Die Website ist dann verfügbar unter `http://localhost:3000`

### Mit Docker direkt

```bash
# Image bauen (aus dem Root-Verzeichnis)
docker build -f webapp/Dockerfile -t kmuc-dev-cli-webapp .

# Container starten
docker run -d \
  --name kmuc-webapp \
  -p 3000:3000 \
  --restart unless-stopped \
  kmuc-dev-cli-webapp

# Logs anzeigen
docker logs -f kmuc-webapp

# Container stoppen
docker stop kmuc-webapp
docker rm kmuc-webapp
```

### Dockerfile Features

- ✅ **Multi-stage Build** - Optimierte Image-Größe
- ✅ **Non-root User** - Security Best Practice
- ✅ **Health Check** - Automatische Container-Überwachung
- ✅ **Alpine Linux** - Minimale Base Image (~50MB)
- ✅ **Production Ready** - NODE_ENV=production

## Production Build (ohne Docker)

Die Website kann auch direkt mit Node.js gehostet werden:

```bash
# Mit dem integrierten Server
npm run webapp

# Oder mit PM2 für Production
npm install -g pm2
pm2 start webapp/server.js --name kmuc-webapp
pm2 save
pm2 startup
```

**Wichtig:** Für Production Hosting muss der Server `server.js` verwendet werden, damit die Version dynamisch injiziert wird.

## Design System

Das Design folgt dem **Vercel Design System**:

- **Colors:** Schwarz/Weiß mit Graustufen
- **Typography:** Geist Sans & Geist Mono
- **Spacing:** 8px Grid
- **Borders:** 1px solid subtle grays
- **Effects:** Subtle hover transitions, glassmorphism

## Features Detail

### Dynamic Version Injection

Die `src/utils/version.js` bietet:

```javascript
const { getVersion, injectVersion } = require('../src/utils/version');

// Version laden
const version = getVersion(); // "2.2.1"

// In HTML injizieren
const html = injectVersion(htmlString);
// Ersetzt: v2.1.0 -> v2.2.1
// Ersetzt: Version 2.1.0 -> Version 2.2.1
```

### Server mit Auto-Reload

Der Dev Server (`server.js`) lädt die Version bei **jedem Request** neu, sodass Änderungen in `package.json` sofort sichtbar sind.

## Links

- [GitHub](https://github.com/KmucDigital/dev-cli)
- [npm](https://www.npmjs.com/package/kmuc-dev-cli)
- [Documentation](http://localhost:3000/dokumentation.html)
