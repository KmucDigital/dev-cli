const fs = require('fs').promises;
const path = require('path');

async function generateDeployScripts(answers, projectPath) {
  const scriptsDir = path.join(projectPath, 'scripts');
  await fs.mkdir(scriptsDir, { recursive: true });

  const { deploymentTarget, needsReverseProxy, needsSSL } = answers;

  // VPS Deploy Script
  if (deploymentTarget === 'vps' || deploymentTarget === 'all') {
    const deployScript = generateVPSDeployScript(answers);
    await fs.writeFile(path.join(scriptsDir, 'deploy.sh'), deployScript, { mode: 0o755 });
  }

  // Domain Setup Script (nginx + SSL)
  if (needsReverseProxy && needsSSL) {
    const domainScript = generateDomainSetupScript(answers);
    await fs.writeFile(path.join(scriptsDir, 'setup-domain.sh'), domainScript, { mode: 0o755 });

    // nginx config
    const nginxConfig = generateNginxConfig(answers);
    await fs.writeFile(path.join(projectPath, 'nginx.conf'), nginxConfig);
  } else if (needsReverseProxy) {
    // Nur nginx ohne SSL
    const nginxConfig = generateNginxConfig(answers);
    await fs.writeFile(path.join(projectPath, 'nginx.conf'), nginxConfig);
  }

  // Cloud Provider Scripts
  if (deploymentTarget === 'cloud' || deploymentTarget === 'all') {
    const cloudScript = generateCloudDeployScript(answers);
    await fs.writeFile(path.join(scriptsDir, 'deploy-cloud.sh'), cloudScript, { mode: 0o755 });
  }

  // Docker Helper Scripts
  const helpersScript = generateDockerHelpers(answers);
  await fs.writeFile(path.join(scriptsDir, 'docker-helpers.sh'), helpersScript, { mode: 0o755 });
}

function generateVPSDeployScript(answers) {
  const { projectName, serverIP, serverUser, serverPort = '22' } = answers;

  return `#!/bin/bash
# VPS Deploy Script für ${projectName}

set -e

echo "🚀 Deploying ${projectName} zu VPS..."

# Konfiguration
SERVER_IP="${serverIP || 'YOUR_SERVER_IP'}"
SERVER_USER="${serverUser || 'root'}"
SERVER_PORT="${serverPort}"
APP_DIR="/opt/${projectName}"

# Farben für Output
GREEN='\\033[0;32m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

echo "📦 Erstelle Deployment-Archiv..."
tar -czf ${projectName}.tar.gz \\
  --exclude='node_modules' \\
  --exclude='.git' \\
  --exclude='*.log' \\
  --exclude='.env' \\
  .

echo "📤 Übertrage Dateien zum Server..."
scp -P \${SERVER_PORT} ${projectName}.tar.gz \${SERVER_USER}@\${SERVER_IP}:/tmp/

echo "🔧 Deploye auf Server..."
ssh -p \${SERVER_PORT} \${SERVER_USER}@\${SERVER_IP} << 'ENDSSH'
  set -e

  # App-Verzeichnis erstellen
  mkdir -p ${APP_DIR}

  # Backup erstellen (falls existiert)
  if [ -d "${APP_DIR}/current" ]; then
    echo "💾 Erstelle Backup..."
    cp -r ${APP_DIR}/current ${APP_DIR}/backup-$(date +%Y%m%d-%H%M%S)
  fi

  # Entpacke neue Version
  echo "📦 Entpacke neue Version..."
  mkdir -p ${APP_DIR}/current
  tar -xzf /tmp/${projectName}.tar.gz -C ${APP_DIR}/current

  # Wechsle zum App-Verzeichnis
  cd ${APP_DIR}/current

  # Docker installieren (falls nicht vorhanden)
  if ! command -v docker &> /dev/null; then
    echo "🐳 Installiere Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
  fi

  # Docker Compose installieren (falls nicht vorhanden)
  if ! command -v docker-compose &> /dev/null; then
    echo "🐳 Installiere Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
  fi

  # .env Datei prüfen
  if [ ! -f .env ]; then
    echo "⚠️  Warnung: .env Datei nicht gefunden!"
    echo "📝 Erstelle .env aus .env.example..."
    cp .env.example .env
    echo "⚠️  WICHTIG: Bearbeite .env mit den richtigen Werten!"
  fi

  # Docker Container bauen und starten
  echo "🐳 Starte Docker Container..."
  docker-compose down || true
  docker-compose build
  docker-compose up -d

  # Cleanup
  rm /tmp/${projectName}.tar.gz

  echo "✅ Deployment abgeschlossen!"
  docker-compose ps
ENDSSH

echo "\${GREEN}✅ Deployment erfolgreich!\${NC}"
echo ""
echo "🌐 Deine App sollte jetzt erreichbar sein"
echo "📊 Logs anzeigen: ssh -p \${SERVER_PORT} \${SERVER_USER}@\${SERVER_IP} 'cd ${APP_DIR}/current && docker-compose logs -f'"
`;
}

function generateDomainSetupScript(answers) {
  const { projectName, domain, port } = answers;

  return `#!/bin/bash
# Domain & SSL Setup Script für ${projectName}

set -e

echo "🌐 Setup Domain und SSL für ${domain}..."

# Farben
GREEN='\\033[0;32m'
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

# Prüfe Root-Rechte
if [ "$EUID" -ne 0 ]; then
  echo "\${RED}❌ Bitte als root ausführen (sudo)\${NC}"
  exit 1
fi

# Domain-Konfiguration
DOMAIN="${domain}"
EMAIL="admin@\${DOMAIN}"

echo "📋 Konfiguration:"
echo "  Domain: \${DOMAIN}"
echo "  Email: \${EMAIL}"
echo ""

# Nginx installieren
if ! command -v nginx &> /dev/null; then
  echo "📦 Installiere nginx..."
  apt-get update
  apt-get install -y nginx
  systemctl enable nginx
fi

# Certbot installieren
if ! command -v certbot &> /dev/null; then
  echo "📦 Installiere certbot..."
  apt-get install -y certbot python3-certbot-nginx
fi

# Nginx Config erstellen
echo "📝 Erstelle nginx Konfiguration..."
cat > /etc/nginx/sites-available/${projectName} << 'NGINX_EOF'
server {
    listen 80;
    server_name ${domain} www.${domain};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\\$host\\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${domain} www.${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    # SSL Konfiguration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
    }
}
NGINX_EOF

# Symbolischen Link erstellen
ln -sf /etc/nginx/sites-available/${projectName} /etc/nginx/sites-enabled/

# Nginx Konfiguration testen
echo "🔍 Teste nginx Konfiguration..."
nginx -t

# Certbot www Verzeichnis erstellen
mkdir -p /var/www/certbot

# SSL Zertifikat erstellen
echo "\${YELLOW}📜 Erstelle SSL Zertifikat...\${NC}"
echo "⚠️  Stelle sicher, dass die Domain auf diese Server-IP zeigt!"
read -p "Fortfahren? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Abgebrochen."
  exit 1
fi

certbot certonly --nginx \\
  -d \${DOMAIN} \\
  -d www.\${DOMAIN} \\
  --email \${EMAIL} \\
  --agree-tos \\
  --no-eff-email \\
  --redirect

# Auto-Renewal einrichten
echo "🔄 Richte automatische Zertifikat-Erneuerung ein..."
systemctl enable certbot.timer
systemctl start certbot.timer

# Nginx neu laden
echo "♻️  Lade nginx neu..."
systemctl reload nginx

echo "\${GREEN}✅ Domain-Setup abgeschlossen!\${NC}"
echo ""
echo "🌐 Deine Seite ist jetzt erreichbar unter:"
echo "   https://\${DOMAIN}"
echo ""
echo "📝 Nützliche Befehle:"
echo "   nginx -t              # Konfiguration testen"
echo "   systemctl reload nginx # nginx neu laden"
echo "   certbot renew --dry-run # SSL-Erneuerung testen"
`;
}

function generateNginxConfig(answers) {
  const { domain, port, needsSSL } = answers;

  if (!needsSSL) {
    // Einfache nginx config ohne SSL
    return `server {
    listen 80;
    server_name ${domain || '_'};

    location / {
        proxy_pass http://app:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
  }

  // nginx config mit SSL
  return `server {
    listen 80;
    server_name ${domain} www.${domain};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${domain} www.${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    # SSL Konfiguration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://app:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
}

function generateCloudDeployScript(answers) {
  const { projectName, cloudProvider = 'generic' } = answers;

  return `#!/bin/bash
# Cloud Deploy Script für ${projectName} (${cloudProvider})

set -e

echo "☁️  Deploy zu ${cloudProvider}..."

# Konfiguration
PROJECT_NAME="${projectName}"
REGION="eu-central-1"  # Passe dies an

case "${cloudProvider}" in
  "digitalocean")
    echo "🌊 DigitalOcean Deployment"
    echo "💡 Tipp: Verwende doctl für einfaches Deployment"
    echo "   doctl compute droplet create ..."
    ;;

  "hetzner")
    echo "🔷 Hetzner Cloud Deployment"
    echo "💡 Tipp: Verwende hcloud CLI"
    echo "   hcloud server create ..."
    ;;

  "aws")
    echo "☁️  AWS EC2 Deployment"
    echo "💡 Tipp: Verwende AWS CLI oder CDK"
    ;;

  *)
    echo "📝 Generisches Cloud Deployment"
    echo ""
    echo "Schritte:"
    echo "1. Erstelle einen Cloud Server/VM"
    echo "2. Kopiere die Dateien auf den Server"
    echo "3. Führe das deploy.sh Script aus"
    ;;
esac

echo ""
echo "📚 Weitere Infos in der Dokumentation des Cloud Providers"
`;
}

function generateDockerHelpers(answers) {
  const { projectName } = answers;

  return `#!/bin/bash
# Docker Helper Scripts für ${projectName}

# Farben
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

show_logs() {
    echo "\${YELLOW}📊 Container Logs:\${NC}"
    docker-compose logs -f --tail=100
}

show_status() {
    echo "\${YELLOW}📊 Container Status:\${NC}"
    docker-compose ps
}

restart_app() {
    echo "\${YELLOW}♻️  Starte Container neu...\${NC}"
    docker-compose restart
    echo "\${GREEN}✅ Neustart abgeschlossen\${NC}"
}

rebuild_app() {
    echo "\${YELLOW}🔨 Rebuilding Container...\${NC}"
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    echo "\${GREEN}✅ Rebuild abgeschlossen\${NC}"
}

cleanup() {
    echo "\${YELLOW}🧹 Cleanup Docker Ressourcen...\${NC}"
    docker system prune -f
    echo "\${GREEN}✅ Cleanup abgeschlossen\${NC}"
}

backup_db() {
    echo "\${YELLOW}💾 Erstelle Datenbank Backup...\${NC}"
    BACKUP_DIR="./backups"
    mkdir -p \${BACKUP_DIR}
    DATE=$(date +%Y%m%d-%H%M%S)
    # Passe dies an deine Datenbank an
    docker-compose exec -T postgres pg_dumpall -U postgres > "\${BACKUP_DIR}/backup-\${DATE}.sql" 2>/dev/null || echo "⚠️  Kein postgres Container gefunden"
    docker-compose exec -T mongodb mongodump --archive > "\${BACKUP_DIR}/backup-\${DATE}.archive" 2>/dev/null || echo "⚠️  Kein mongodb Container gefunden"
    echo "\${GREEN}✅ Backup erstellt\${NC}"
}

# Main
case "$1" in
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    restart)
        restart_app
        ;;
    rebuild)
        rebuild_app
        ;;
    cleanup)
        cleanup
        ;;
    backup)
        backup_db
        ;;
    *)
        echo "Usage: $0 {logs|status|restart|rebuild|cleanup|backup}"
        exit 1
        ;;
esac
`;
}

module.exports = { generateDeployScripts };
