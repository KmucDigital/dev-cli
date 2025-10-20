const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function devCommand(options) {
  console.log(chalk.cyan.bold('\n🛠️  KMUC Dev Mode\n'));

  const hotReload = options.hotReload !== false; // Default true
  const debug = options.debug || false;
  const tail = options.tail !== false; // Default true

  try {
    // Check if docker-compose.yml exists
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    // Create dev override
    const spinner = ora('Erstelle Development-Konfiguration...').start();

    try {
      const baseCompose = await fs.readFile('docker-compose.yml', 'utf8');

      // Detect project type from base compose
      const projectType = await detectProjectType();

      const devOverride = generateDevOverride(baseCompose, { hotReload, debug, projectType });

      await fs.writeFile('docker-compose.dev.yml', devOverride);

      // For static sites: Create nginx dev config without caching
      if (projectType === 'static' || projectType === 'react-vite') {
        await createNginxDevConfig();
      }

      spinner.succeed('Development-Konfiguration erstellt');
    } catch (error) {
      spinner.fail('Konnte Dev-Config nicht erstellen');
      throw error;
    }

    // Stop any running containers
    const stopSpinner = ora('Stoppe alte Container...').start();
    try {
      await execAsync('docker-compose down');
      stopSpinner.succeed('Container gestoppt');
    } catch (error) {
      stopSpinner.info('Keine laufenden Container');
    }

    // Start dev environment
    console.log();
    console.log(chalk.cyan.bold('🚀 Starte Development Environment\n'));

    // Windows uses semicolon as path separator, Unix uses colon
    const pathSeparator = process.platform === 'win32' ? ';' : ':';

    const envVars = {
      ...process.env,
      NODE_ENV: 'development',
      COMPOSE_FILE: `docker-compose.yml${pathSeparator}docker-compose.dev.yml`
    };

    const startSpinner = ora('Starte Container...').start();

    try {
      await execAsync('docker-compose up -d', { env: envVars });
      startSpinner.succeed('Container gestartet');
    } catch (error) {
      startSpinner.fail('Start fehlgeschlagen');
      throw error;
    }

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Show status
    console.log();
    try {
      const { stdout } = await execAsync('docker-compose ps', { env: envVars });
      const lines = stdout.split('\n').filter(l => l.trim() && l.includes('Up'));

      if (lines.length > 0) {
        console.log(chalk.green.bold('✅ Development Mode aktiv!\n'));

        // Show features
        console.log(chalk.cyan('📋 Aktivierte Features:'));
        if (hotReload) console.log(chalk.gray('  ✓ Hot-Reload (Volume Mounts)'));
        if (debug) console.log(chalk.gray('  ✓ Debug-Ports aktiviert'));
        console.log(chalk.gray('  ✓ Development Environment'));

        // Show debug ports
        if (debug) {
          console.log();
          console.log(chalk.yellow('🐛 Debug-Ports:'));
          console.log(chalk.gray('  Node.js: localhost:9229'));
          console.log(chalk.gray('  Python: localhost:5678'));
        }

        // Get port
        const composeContent = await fs.readFile('docker-compose.yml', 'utf8');
        const port = extractPort(composeContent);

        if (port) {
          console.log();
          console.log(chalk.cyan('🌐 App läuft auf:'));
          console.log(chalk.yellow(`   http://localhost:${port}\n`));
        }

        console.log(chalk.gray('💡 Nützliche Befehle:'));
        console.log(chalk.gray('   kmuc logs'), chalk.dim('- Live-Logs anzeigen'));
        console.log(chalk.gray('   kmuc status'), chalk.dim('- Container Status'));
        console.log(chalk.gray('   docker-compose down'), chalk.dim('- Dev-Mode beenden'));
        console.log();

        // Auto-open logs if requested
        if (tail) {
          console.log(chalk.cyan('📊 Live Logs (Drücke Ctrl+C zum Beenden)\n'));

          const logsProcess = spawn('docker-compose', ['logs', '-f', '--tail=50'], {
            stdio: 'inherit',
            env: envVars
          });

          // Handle Ctrl+C
          process.on('SIGINT', () => {
            console.log(chalk.cyan('\n\n👋 Logs beendet'));
            console.log(chalk.gray('Container laufen weiter im Hintergrund\n'));
            logsProcess.kill();
            process.exit(0);
          });
        }

      } else {
        console.log(chalk.yellow('⚠️  Container gestartet, aber Status unklar\n'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Status konnte nicht geprüft werden'));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log();
    console.log(chalk.yellow('💡 Versuche:'));
    console.log(chalk.gray('   docker-compose down'));
    console.log(chalk.gray('   kmuc dev\n'));
    process.exit(1);
  }
}

function generateDevOverride(baseCompose, options) {
  const { hotReload, debug, projectType } = options;

  let override = `# Development Override - Auto-generated by KMUC Dev CLI
# Do not edit manually - will be regenerated

version: '3.8'

services:
  app:
    environment:
      - NODE_ENV=development
      - DEBUG=*
`;

  // Add volume mounts for hot-reload
  if (hotReload) {
    if (projectType === 'static') {
      // For static sites: Mount source to nginx html dir with dev config
      override += `    volumes:
      - ./:/usr/share/nginx/html:ro
      - ./nginx.dev.conf:/etc/nginx/conf.d/default.conf:ro
`;
    } else if (projectType === 'react-vite') {
      // For React Vite: Mount dist directory (must rebuild separately)
      override += `    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx.dev.conf:/etc/nginx/conf.d/default.conf:ro
`;
    } else {
      // For Node.js apps: Mount entire app directory
      override += `    volumes:
      - ./:/app
      - /app/node_modules
`;
    }
  }

  // For Node.js projects: Use nodemon for hot-reload
  if (hotReload && projectType !== 'static' && projectType !== 'react-vite') {
    override += `    command: npx nodemon --legacy-watch --watch . --ext js,json,ts,tsx,jsx server.js
`;
  }

  // Add debug ports
  if (debug) {
    override += `    ports:
      - "9229:9229"  # Node.js debug
      - "5678:5678"  # Python debug
`;
  }

  // Restart policy for development
  override += `    restart: "no"
`;

  return override;
}

function extractPort(composeContent) {
  const portMatch = composeContent.match(/["']?(\d+):\d+["']?/);
  return portMatch ? portMatch[1] : null;
}

async function checkFile(filename) {
  try {
    await fs.access(path.join(process.cwd(), filename));
    return true;
  } catch {
    return false;
  }
}

async function detectProjectType() {
  // Check for Next.js
  if (await checkFile('next.config.js') || await checkFile('next.config.mjs')) {
    return 'nextjs';
  }

  // Check for Vite
  if (await checkFile('vite.config.js') || await checkFile('vite.config.ts')) {
    return 'react-vite';
  }

  // Check for static site
  const hasIndexHtml = await checkFile('index.html') ||
                       await checkFile('public/index.html');
  const hasPackageJson = await checkFile('package.json');

  if (hasIndexHtml && !hasPackageJson) {
    return 'static';
  }

  // Check Dockerfile for static/nginx
  try {
    const dockerfile = await fs.readFile('Dockerfile', 'utf8');
    if (dockerfile.includes('FROM nginx')) {
      return 'static';
    }
  } catch (error) {
    // Ignore
  }

  // Check for Express
  try {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    if (packageJson.dependencies?.express) {
      return 'express';
    }
  } catch (error) {
    // Ignore
  }

  // Default to node-basic
  return 'node-basic';
}

async function createNginxDevConfig() {
  const nginxDevConfigPath = path.join(process.cwd(), 'nginx.dev.conf');

  // Check if nginx.dev.conf exists as directory and remove it
  try {
    const stats = await fs.stat(nginxDevConfigPath);
    if (stats.isDirectory()) {
      await fs.rm(nginxDevConfigPath, { recursive: true, force: true });
    }
  } catch (error) {
    // File doesn't exist, which is fine
  }

  const nginxDevConfig = `server {
    listen 80;
    server_name localhost;

    # Root directory
    root /usr/share/nginx/html;
    index index.html index.htm;

    # Disable all caching for development
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    add_header Pragma "no-cache";
    add_header Expires "0";

    # Disable etag
    etag off;
    if_modified_since off;

    location / {
        try_files $uri $uri/ /index.html;

        # Additional no-cache headers for HTML files
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    }

    # Also disable cache for JS/CSS in dev mode
    location ~* \\.(js|css)$ {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        try_files $uri =404;
    }

    # Images and other assets
    location ~* \\.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        try_files $uri =404;
    }
}`;

  await fs.writeFile(nginxDevConfigPath, nginxDevConfig);
}

module.exports = { devCommand };
