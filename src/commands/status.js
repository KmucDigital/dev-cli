const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function statusCommand(options) {
  const watch = options.watch || false;

  try {
    // Prüfe ob docker-compose.yml existiert
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('\n❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    if (watch) {
      // Watch-Mode: Aktualisiert alle 2 Sekunden
      console.log(chalk.cyan('📊 Status Dashboard (Drücke Ctrl+C zum Beenden)\n'));

      const refreshStatus = async () => {
        // Clear screen
        process.stdout.write('\x1Bc');
        console.log(chalk.cyan.bold('📊 KMUC Hoster Status Dashboard\n'));
        await displayStatus();
        console.log(chalk.gray('\n🔄 Aktualisiert alle 2 Sekunden | Drücke Ctrl+C zum Beenden'));
      };

      // Initial display
      await refreshStatus();

      // Refresh every 2 seconds
      const interval = setInterval(refreshStatus, 2000);

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(chalk.cyan('\n\n👋 Status Dashboard beendet\n'));
        process.exit(0);
      });
    } else {
      // Single display
      console.log(chalk.cyan.bold('\n📊 KMUC Hoster Status Dashboard\n'));
      await displayStatus();
      console.log(chalk.gray('\n💡 Nutze --watch für Live-Updates'));
      console.log();
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    process.exit(1);
  }
}

async function displayStatus() {
  try {
    // Get container status
    const { stdout: psOutput } = await execAsync('docker-compose ps --format json');

    if (!psOutput.trim()) {
      console.log(chalk.yellow('⚠️  Keine Container gefunden'));
      console.log(chalk.gray('   Starte dein Projekt mit: kmuc publish\n'));
      return;
    }

    const containers = psOutput.trim().split('\n').map(line => JSON.parse(line));

    // Get stats for running containers
    let stats = {};
    try {
      const runningContainers = containers.filter(c => c.State === 'running');
      if (runningContainers.length > 0) {
        const containerNames = runningContainers.map(c => c.Name).join(' ');
        const { stdout: statsOutput } = await execAsync(
          `docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}" ${containerNames}`
        );

        statsOutput.trim().split('\n').forEach(line => {
          const [name, cpu, mem, net] = line.split('|');
          stats[name] = { cpu, mem, net };
        });
      }
    } catch (error) {
      // Stats not available
    }

    // Display header
    console.log(chalk.gray('━'.repeat(100)));
    console.log(
      chalk.bold('SERVICE').padEnd(25) +
      chalk.bold('STATUS').padEnd(15) +
      chalk.bold('PORTS').padEnd(30) +
      chalk.bold('CPU').padEnd(12) +
      chalk.bold('MEMORY')
    );
    console.log(chalk.gray('━'.repeat(100)));

    // Display each container
    for (const container of containers) {
      const service = container.Service.padEnd(23);

      // Status with color
      let statusIcon, statusText, statusColor;
      if (container.State === 'running') {
        if (container.Health === 'healthy' || container.Health === '') {
          statusIcon = '🟢';
          statusText = 'Running';
          statusColor = chalk.green;
        } else if (container.Health === 'unhealthy') {
          statusIcon = '🔴';
          statusText = 'Unhealthy';
          statusColor = chalk.red;
        } else {
          statusIcon = '🟡';
          statusText = 'Starting';
          statusColor = chalk.yellow;
        }
      } else if (container.State === 'exited') {
        statusIcon = '⚫';
        statusText = 'Stopped';
        statusColor = chalk.gray;
      } else {
        statusIcon = '🔴';
        statusText = container.State;
        statusColor = chalk.red;
      }

      const status = (statusIcon + ' ' + statusText).padEnd(22);

      // Ports
      const ports = container.Publishers ?
        container.Publishers.map(p => `${p.PublishedPort}→${p.TargetPort}`).join(', ') :
        '-';
      const portsStr = ports.substring(0, 28).padEnd(28);

      // Stats
      const containerStats = stats[container.Name];
      const cpu = containerStats ? containerStats.cpu.padEnd(10) : '-'.padEnd(10);
      const mem = containerStats ? containerStats.mem : '-';

      console.log(
        chalk.cyan(service) +
        statusColor(status) +
        chalk.gray(portsStr) +
        chalk.yellow(cpu) +
        chalk.magenta(mem)
      );
    }

    console.log(chalk.gray('━'.repeat(100)));

    // Summary
    const total = containers.length;
    const running = containers.filter(c => c.State === 'running').length;
    const stopped = containers.filter(c => c.State === 'exited').length;
    const unhealthy = containers.filter(c => c.Health === 'unhealthy').length;

    console.log();
    console.log(
      chalk.gray('Total: ') + chalk.white(total) + ' | ' +
      chalk.green('Running: ' + running) + ' | ' +
      chalk.gray('Stopped: ' + stopped) +
      (unhealthy > 0 ? ' | ' + chalk.red('Unhealthy: ' + unhealthy) : '')
    );

  } catch (error) {
    console.log(chalk.red('❌ Konnte Status nicht abrufen'));
    console.log(chalk.yellow('💡 Docker läuft möglicherweise nicht'));
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

module.exports = { statusCommand };
