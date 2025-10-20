const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function publishCommand(options) {
  console.log(chalk.cyan.bold('\n🚀 KMUC Hoster Publish\n'));

  const isProduction = options.production || false;

  // Check if we're in a directory (not root)
  const cwd = process.cwd();
  if (cwd === '/' || cwd === 'C:\\' || cwd === 'C:/') {
    console.error(chalk.red('❌ Nicht im Root-Verzeichnis ausführen!'));
    console.log(chalk.yellow('💡 Navigiere zu deinem Projekt-Verzeichnis\n'));
    process.exit(1);
  }

  try {
    // 1. Prüfe ob docker-compose.yml existiert
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('❌ docker-compose.yml nicht gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    // 1.5. Prüfe ob es ein statisches Projekt ist und erstelle Server
    const isStatic = await isStaticProject();
    if (isStatic) {
      await setupStaticServer();
    }

    // 2. Prüfe ob .env existiert
    const envExists = await checkFile('.env');
    if (!envExists) {
      const envExampleExists = await checkFile('.env.example');
      if (envExampleExists) {
        console.log(chalk.yellow('⚠️  .env Datei nicht gefunden'));
        const spinner = ora('Erstelle .env aus .env.example...').start();
        await fs.copyFile('.env.example', '.env');
        spinner.succeed('.env Datei erstellt');
        console.log(chalk.yellow('⚠️  WICHTIG: Bearbeite .env und passe die Werte an!\n'));
      } else {
        console.error(chalk.red('❌ Keine .env oder .env.example gefunden!'));
        process.exit(1);
      }
    }

    // 3. Prüfe Docker Installation
    const spinner = ora('Prüfe Docker Installation...').start();
    try {
      await execAsync('docker --version');
      await execAsync('docker-compose --version');
      spinner.succeed('Docker ist installiert');
    } catch (error) {
      spinner.fail('Docker nicht gefunden!');
      console.log(chalk.yellow('\n💡 Installiere Docker:'));
      console.log(chalk.gray('   https://docs.docker.com/get-docker/\n'));
      process.exit(1);
    }

    // 4. Stoppe alte Container (falls vorhanden)
    const stopSpinner = ora('Stoppe alte Container...').start();
    try {
      await execAsync('docker-compose down', { cwd: process.cwd() });
      stopSpinner.succeed('Alte Container gestoppt');
    } catch (error) {
      stopSpinner.info('Keine laufenden Container gefunden');
    }

    // 5. Prüfe package.json (für Node.js Projekte)
    const packageJsonExists = await checkFile('package.json');
    if (!packageJsonExists) {
      console.log(chalk.yellow('⚠️  package.json nicht gefunden!'));
      console.log(chalk.gray('Wenn dies ein Node.js Projekt ist, erstelle package.json mit:'));
      console.log(chalk.gray('  npm init -y\n'));
    }

    // 6. Validiere Dockerfile
    const validateSpinner = ora('Validiere Dockerfile...').start();
    const dockerfileExists = await checkFile('Dockerfile');
    if (!dockerfileExists) {
      validateSpinner.fail('Dockerfile nicht gefunden!');
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    // Prüfe auf häufige Dockerfile-Fehler
    try {
      const dockerfileContent = await fs.readFile('Dockerfile', 'utf8');

      // Prüfe auf Shell-Syntax die nicht funktioniert
      if (dockerfileContent.includes('2>/dev/null ||') || dockerfileContent.includes('|| echo')) {
        validateSpinner.fail('Dockerfile enthält ungültige Shell-Syntax');
        console.log(chalk.red('❌ Dockerfile hat Syntax-Fehler'));
        console.log(chalk.yellow('💡 Führe "kmuc init" erneut aus um ein korrektes Dockerfile zu generieren\n'));
        process.exit(1);
      }

      validateSpinner.succeed('Dockerfile validiert');
    } catch (error) {
      validateSpinner.warn('Konnte Dockerfile nicht validieren');
    }

    // 7. Baue Container
    const buildSpinner = ora('Baue Docker Images...').start();
    try {
      const { stdout, stderr } = await execAsync('docker-compose build', {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      buildSpinner.succeed('Docker Images gebaut');
    } catch (error) {
      buildSpinner.fail('Build fehlgeschlagen');
      console.log();
      console.log(chalk.red('❌ Docker Build Fehler:\n'));

      // Zeige nur relevante Fehlerzeilen
      const errorLines = error.message.split('\n').filter(line =>
        line.includes('ERROR') ||
        line.includes('failed') ||
        line.includes('>>>') ||
        line.trim().startsWith('>')
      );

      if (errorLines.length > 0) {
        errorLines.slice(0, 10).forEach(line => {
          console.log(chalk.gray(line));
        });
      } else {
        console.log(chalk.gray(error.message));
      }

      console.log();
      console.log(chalk.yellow('💡 Mögliche Lösungen:'));
      console.log(chalk.gray('  1. Stelle sicher, dass package.json existiert'));
      console.log(chalk.gray('  2. Führe "kmuc init" erneut aus'));
      console.log(chalk.gray('  3. Lösche Docker Cache: docker-compose build --no-cache'));
      console.log(chalk.gray('  4. Prüfe ob Node.js Image verfügbar: docker pull node:20-alpine\n'));
      process.exit(1);
    }

    // 8. Starte Container
    const startSpinner = ora('Starte Container...').start();
    try {
      await execAsync('docker-compose up -d', { cwd: process.cwd() });
      startSpinner.succeed('Container gestartet');
    } catch (error) {
      startSpinner.fail('Start fehlgeschlagen');
      console.log();
      console.log(chalk.red('❌ Container Start Fehler:\n'));
      console.log(chalk.gray(error.message));
      console.log();
      console.log(chalk.yellow('💡 Prüfe Logs mit:'));
      console.log(chalk.gray('  docker-compose logs\n'));
      process.exit(1);
    }

    // 9. Warte kurz und prüfe Status
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusSpinner = ora('Prüfe Container Status...').start();
    try {
      const { stdout } = await execAsync('docker-compose ps', { cwd: process.cwd() });
      statusSpinner.succeed('Status geprüft');

      // Parse docker-compose ps output
      const lines = stdout.split('\n').filter(l => l.trim());
      const runningContainers = lines.filter(l => l.includes('Up')).length;

      console.log();
      if (runningContainers > 0) {
        console.log(chalk.green.bold('✅ Erfolgreich deployed!\n'));

        // Lese Port aus docker-compose.yml
        const port = await getPortFromCompose();
        if (port) {
          console.log(chalk.cyan('🌐 Deine App läuft auf:'));
          console.log(chalk.yellow(`   http://localhost:${port}\n`));
        }

        console.log(chalk.cyan('📊 Nützliche Befehle:'));
        console.log(chalk.gray('   docker-compose logs -f'), chalk.dim('- Logs anzeigen'));
        console.log(chalk.gray('   docker-compose ps'), chalk.dim('- Status anzeigen'));
        console.log(chalk.gray('   docker-compose down'), chalk.dim('- Stoppen'));
        console.log(chalk.gray('   docker-compose restart'), chalk.dim('- Neustarten'));

        // Prüfe ob Domain-Setup existiert
        if (await checkFile('scripts/setup-domain.sh')) {
          console.log();
          console.log(chalk.cyan('🌐 Domain Setup verfügbar:'));
          console.log(chalk.gray('   sudo ./scripts/setup-domain.sh'), chalk.dim('- Domain & SSL einrichten'));
        }

        console.log();
      } else {
        console.log(chalk.yellow('⚠️  Container gestartet, aber Status unklar'));
        console.log(chalk.gray('   Prüfe mit: docker-compose logs\n'));
      }
    } catch (error) {
      statusSpinner.fail('Status-Prüfung fehlgeschlagen');
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    process.exit(1);
  }
}

async function checkFile(filename) {
  try {
    await fs.access(path.join(process.cwd(), filename));
    return true;
  } catch {
    return false;
  }
}

async function getPortFromCompose() {
  try {
    const composeContent = await fs.readFile('docker-compose.yml', 'utf8');
    // Suche nach Port Mapping wie "3000:3000" oder "- 3000:3000"
    const portMatch = composeContent.match(/["']?(\d+):\d+["']?/);
    if (portMatch) {
      return portMatch[1];
    }

    // Suche nach Port aus Environment
    const envPortMatch = composeContent.match(/PORT[=:]?\s*(\d+)/);
    if (envPortMatch) {
      return envPortMatch[1];
    }
  } catch (error) {
    // Ignoriere Fehler
  }
  return null;
}

async function isStaticProject() {
  // Prüfe ob es index.html gibt
  const hasIndexHtml = await checkFile('index.html') ||
                       await checkFile('public/index.html') ||
                       await checkFile('dist/index.html') ||
                       await checkFile('build/index.html');

  // Prüfe ob es kein server.js gibt
  const hasServerJs = await checkFile('server.js');

  // Prüfe Dockerfile auf nginx oder static indicators
  try {
    const dockerfileContent = await fs.readFile('Dockerfile', 'utf8');
    if (dockerfileContent.includes('nginx') || dockerfileContent.includes('FROM nginx')) {
      return true;
    }
  } catch (error) {
    // Dockerfile might not exist yet
  }

  return hasIndexHtml && !hasServerJs;
}

async function setupStaticServer() {
  const spinner = ora('Erstelle statischen Server...').start();

  try {
    // Check if server.js already exists
    if (await checkFile('server.js')) {
      spinner.info('server.js existiert bereits');
      return;
    }

    // Read template
    const templatePath = path.join(__dirname, '..', 'templates', 'static-server.js');
    const serverTemplate = await fs.readFile(templatePath, 'utf8');

    // Create server.js
    await fs.writeFile('server.js', serverTemplate);

    // Check if package.json exists
    let packageJsonExists = await checkFile('package.json');

    if (!packageJsonExists) {
      // Create package.json from template
      const packageTemplatePath = path.join(__dirname, '..', 'templates', 'static-package.json');
      const packageTemplate = await fs.readFile(packageTemplatePath, 'utf8');
      await fs.writeFile('package.json', packageTemplate);
      spinner.text = 'Installiere Dependencies...';

      // Install dependencies
      try {
        await execAsync('pnpm install', { cwd: process.cwd() });
      } catch (error) {
        // Fallback to npm if pnpm not available
        await execAsync('npm install', { cwd: process.cwd() });
      }
    } else {
      // Add express to existing package.json
      spinner.text = 'Füge Express hinzu...';
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));

      if (!packageJson.dependencies) {
        packageJson.dependencies = {};
      }

      if (!packageJson.dependencies.express) {
        packageJson.dependencies.express = '^4.18.2';
        await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));

        try {
          await execAsync('pnpm install', { cwd: process.cwd() });
        } catch (error) {
          await execAsync('npm install', { cwd: process.cwd() });
        }
      }
    }

    // Create public directory and move files
    const publicDir = path.join(process.cwd(), 'public');

    if (!await checkFile('public')) {
      await fs.mkdir(publicDir, { recursive: true });

      // Move static files to public directory
      const staticFiles = ['index.html', 'style.css', 'styles.css', 'main.css', 'script.js', 'app.js', 'main.js'];

      for (const file of staticFiles) {
        if (await checkFile(file)) {
          await fs.rename(
            path.join(process.cwd(), file),
            path.join(publicDir, file)
          );
        }
      }

      // Move directories like css, js, images, assets
      const staticDirs = ['css', 'js', 'images', 'img', 'assets', 'fonts'];

      for (const dir of staticDirs) {
        if (await checkFile(dir)) {
          const sourcePath = path.join(process.cwd(), dir);
          const destPath = path.join(publicDir, dir);

          try {
            await fs.rename(sourcePath, destPath);
          } catch (error) {
            // Directory might not be movable, try copying
            try {
              await fs.cp(sourcePath, destPath, { recursive: true });
            } catch (e) {
              // Ignore copy errors
            }
          }
        }
      }
    }

    // Update Dockerfile to use Node.js
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    if (await checkFile('Dockerfile')) {
      const dockerfile = await fs.readFile(dockerfilePath, 'utf8');

      // Only update if it's an nginx Dockerfile
      if (dockerfile.includes('nginx')) {
        const newDockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]`;

        await fs.writeFile(dockerfilePath, newDockerfile);
      }
    }

    spinner.succeed('Statischer Server erstellt');
    console.log();
    console.log(chalk.cyan('📦 Server Details:'));
    console.log(chalk.gray('   ✓ server.js erstellt'));
    console.log(chalk.gray('   ✓ Express Server konfiguriert'));
    console.log(chalk.gray('   ✓ Statische Dateien in public/'));
    console.log();

  } catch (error) {
    spinner.fail('Fehler beim Erstellen des Servers');
    console.error(chalk.red('Fehler:'), error.message);
  }
}

module.exports = { publishCommand };
