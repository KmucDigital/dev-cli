#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk').default || require('chalk');
const { initCommand } = require('../src/commands/init');
const { deployCommand } = require('../src/commands/deploy');
const { publishCommand } = require('../src/commands/publish');
const { helpCommand } = require('../src/commands/help');
const { logsCommand } = require('../src/commands/logs');
const { statusCommand } = require('../src/commands/status');
const { updateCommand } = require('../src/commands/update');
const { cleanCommand } = require('../src/commands/clean');
const { devCommand } = require('../src/commands/dev');
const { dbConnectCommand } = require('../src/commands/db-connect');
const { backupCommand } = require('../src/commands/backup');
const { healthCommand } = require('../src/commands/health');
const { sslStatusCommand, sslRenewCommand, sslAutoCommand } = require('../src/commands/ssl');
const { ciGithubCommand, ciGitlabCommand } = require('../src/commands/ci');

const program = new Command();

program
  .name('kmuc')
  .description('Complete development CLI for modern web projects - Your toolkit from init to deploy')
  .version('2.1.2');

program
  .command('init')
  .description('Initialisiere ein neues Projekt mit Docker-Setup')
  .option('-d, --directory <path>', 'Zielverzeichnis', '.')
  .action(initCommand);

program
  .command('publish')
  .description('Baue und starte dein Projekt (automatisches Docker Deployment)')
  .action(publishCommand);

program
  .command('deploy')
  .description('Deploy auf VPS/Server via SSH (führt deploy.sh aus)')
  .action(deployCommand);

program
  .command('help')
  .description('Öffne die vollständige Dokumentation im Browser')
  .action(helpCommand);

program
  .command('logs')
  .description('Zeige Container Logs (intelligent gefiltert)')
  .option('--detailed', 'Zeige detaillierte Logs aller Services mit Timestamps')
  .action(logsCommand);

program
  .command('status')
  .description('Zeige Container Status Dashboard')
  .option('-w, --watch', 'Live-Updates alle 2 Sekunden')
  .action(statusCommand);

program
  .command('update')
  .description('Aktualisiere Docker Images')
  .option('-f, --force', 'Erzwinge Update auch wenn keine neue Version verfügbar')
  .action(updateCommand);

program
  .command('clean')
  .description('Räume Docker Ressourcen auf')
  .option('--all', 'Entferne alle ungenutzten Ressourcen')
  .action(cleanCommand);

program
  .command('dev')
  .description('Starte Development Mode')
  .option('--no-hot-reload', 'Deaktiviere Hot-Reload')
  .option('--debug', 'Aktiviere Debug-Ports')
  .option('--no-tail', 'Zeige keine Live-Logs')
  .action(devCommand);

program
  .command('db:connect')
  .description('Verbinde mit der Datenbank (auto-detect)')
  .action(dbConnectCommand);

program
  .command('backup')
  .description('Backup-System für Container, Volumes und Datenbanken')
  .action(backupCommand);

program
  .command('health')
  .description('System Health Check (Docker, Container, Datenbank, Ports)')
  .action(healthCommand);

program
  .command('ssl:status')
  .description('Zeige SSL Zertifikat Status')
  .action(sslStatusCommand);

program
  .command('ssl:renew')
  .description('Erneuere SSL Zertifikate (Let\'s Encrypt)')
  .action(sslRenewCommand);

program
  .command('ssl:auto')
  .description('Richte automatische SSL-Erneuerung ein')
  .action(sslAutoCommand);

program
  .command('ci:github')
  .description('Generiere GitHub Actions Workflow')
  .action(ciGithubCommand);

program
  .command('ci:gitlab')
  .description('Generiere GitLab CI Pipeline')
  .action(ciGitlabCommand);

program.parse(process.argv);

// Zeige Hilfe wenn kein Befehl angegeben wurde
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log();
  console.log(chalk.cyan('💡 Tipp: Starte mit'), chalk.yellow('kmuc init'), chalk.cyan('um ein neues Projekt zu erstellen'));
}
