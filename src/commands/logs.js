const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const fs = require('fs').promises;
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

async function logsCommand(options) {
  const isDetailed = options.detailed || false;

  try {
    // Prüfe ob docker-compose.yml existiert
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('\n❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    // Lese docker-compose.yml um Services zu identifizieren
    const composeContent = await fs.readFile('docker-compose.yml', 'utf8');
    const services = parseServices(composeContent);

    if (services.length === 0) {
      console.error(chalk.red('\n❌ Keine Services gefunden!\n'));
      process.exit(1);
    }

    console.log(chalk.cyan.bold('\n📋 KMUC Hoster Logs\n'));

    // Zeige verfügbare Services
    console.log(chalk.gray('Verfügbare Services:'));
    services.forEach(service => {
      console.log(chalk.gray(`  • ${service}`));
    });
    console.log();

    // Prüfe ob Container laufen
    const spinner = ora('Prüfe Container Status...').start();
    try {
      const { stdout } = await execAsync('docker-compose ps --services --filter "status=running"');
      const runningServices = stdout.trim().split('\n').filter(s => s);

      if (runningServices.length === 0) {
        spinner.fail('Keine laufenden Container gefunden');
        console.log();
        console.log(chalk.yellow('💡 Starte dein Projekt mit:'));
        console.log(chalk.gray('   kmuc publish\n'));
        process.exit(0);
      }

      spinner.succeed(`${runningServices.length} Container läuft/laufen`);
    } catch (error) {
      spinner.fail('Konnte Container Status nicht prüfen');
      console.log(chalk.yellow('⚠️  Docker Compose nicht verfügbar\n'));
      process.exit(1);
    }

    // Intelligente Log-Anzeige
    console.log();
    if (isDetailed) {
      console.log(chalk.cyan.bold('🔍 Detaillierte Logs (alle Services)\n'));
      console.log(chalk.gray('Drücke Ctrl+C zum Beenden\n'));

      // Zeige detaillierte Logs mit Timestamps
      const logsProcess = spawn('docker-compose', ['logs', '-f', '--timestamps'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      logsProcess.on('error', (error) => {
        console.error(chalk.red('\n❌ Fehler beim Anzeigen der Logs:'), error.message);
        process.exit(1);
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.cyan('\n\n👋 Logs beendet\n'));
        logsProcess.kill();
        process.exit(0);
      });

    } else {
      // Intelligente Kurzansicht: Hauptservice und Fehler
      console.log(chalk.cyan.bold('📊 Live Logs (Hauptservice + Fehler)\n'));
      console.log(chalk.gray('Nutze --detailed für alle Logs\n'));
      console.log(chalk.gray('Drücke Ctrl+C zum Beenden\n'));

      // Bestimme Hauptservice (app, web, oder erster Service)
      let mainService = 'app';
      if (!services.includes('app')) {
        mainService = services.find(s => s.includes('web') || s.includes('frontend') || s.includes('backend')) || services[0];
      }

      // Zeige nur Hauptservice, aber mit Fehlerfilterung für alle
      const logsArgs = isDetailed
        ? ['logs', '-f', '--timestamps']
        : ['logs', '-f', '--tail=50', mainService];

      const logsProcess = spawn('docker-compose', logsArgs, {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      // Verarbeite Output
      logsProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (!line.trim()) return;

          // Highlight Errors und Warnings
          if (line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')) {
            console.log(chalk.red(line));
          } else if (line.toLowerCase().includes('warn')) {
            console.log(chalk.yellow(line));
          } else if (line.toLowerCase().includes('success') || line.toLowerCase().includes('started')) {
            console.log(chalk.green(line));
          } else {
            console.log(chalk.gray(line));
          }
        });
      });

      logsProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            console.log(chalk.red(line));
          }
        });
      });

      logsProcess.on('error', (error) => {
        console.error(chalk.red('\n❌ Fehler beim Anzeigen der Logs:'), error.message);
        process.exit(1);
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.cyan('\n\n👋 Logs beendet'));
        console.log(chalk.gray('\n💡 Nützliche Befehle:'));
        console.log(chalk.gray('   kmuc logs --detailed'), chalk.dim('- Alle Logs'));
        console.log(chalk.gray('   docker-compose ps'), chalk.dim('- Container Status'));
        console.log(chalk.gray('   docker-compose restart'), chalk.dim('- Container neu starten\n'));
        logsProcess.kill();
        process.exit(0);
      });
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

function parseServices(composeContent) {
  const services = [];
  const lines = composeContent.split('\n');
  let inServices = false;

  for (const line of lines) {
    if (line.trim() === 'services:') {
      inServices = true;
      continue;
    }

    if (inServices) {
      // Wenn neue Top-Level Section beginnt (z.B. networks, volumes)
      if (line.match(/^[a-z]+:$/) && !line.startsWith(' ')) {
        break;
      }

      // Service Definition (2 Spaces Indent)
      const serviceMatch = line.match(/^  ([a-z0-9_-]+):/);
      if (serviceMatch) {
        services.push(serviceMatch[1]);
      }
    }
  }

  return services;
}

module.exports = { logsCommand };
