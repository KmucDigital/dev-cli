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
      console.log(chalk.yellow('💡 Führe zuerst "kmuc-hoster init" aus\n'));
      process.exit(1);
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

    // 5. Validiere Dockerfile
    const validateSpinner = ora('Validiere Dockerfile...').start();
    const dockerfileExists = await checkFile('Dockerfile');
    if (!dockerfileExists) {
      validateSpinner.fail('Dockerfile nicht gefunden!');
      console.log(chalk.yellow('💡 Führe zuerst "kmuc-hoster init" aus\n'));
      process.exit(1);
    }

    // Prüfe auf häufige Dockerfile-Fehler
    try {
      const dockerfileContent = await fs.readFile('Dockerfile', 'utf8');

      // Prüfe auf Shell-Syntax die nicht funktioniert
      if (dockerfileContent.includes('2>/dev/null ||') || dockerfileContent.includes('|| echo')) {
        validateSpinner.fail('Dockerfile enthält ungültige Shell-Syntax');
        console.log(chalk.red('❌ Dockerfile hat Syntax-Fehler'));
        console.log(chalk.yellow('💡 Führe "kmuc-hoster init" erneut aus um ein korrektes Dockerfile zu generieren\n'));
        process.exit(1);
      }

      validateSpinner.succeed('Dockerfile validiert');
    } catch (error) {
      validateSpinner.warn('Konnte Dockerfile nicht validieren');
    }

    // 6. Baue Container
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
      console.log(chalk.gray('  1. Führe "kmuc-hoster init" erneut aus'));
      console.log(chalk.gray('  2. Prüfe das Dockerfile auf Syntax-Fehler'));
      console.log(chalk.gray('  3. Prüfe docker-compose.yml\n'));
      process.exit(1);
    }

    // 7. Starte Container
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

    // 8. Warte kurz und prüfe Status
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

module.exports = { publishCommand };
