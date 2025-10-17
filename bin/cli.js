#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk').default || require('chalk');
const { initCommand } = require('../src/commands/init');
const { deployCommand } = require('../src/commands/deploy');
const { publishCommand } = require('../src/commands/publish');
const { helpCommand } = require('../src/commands/help');
const { logsCommand } = require('../src/commands/logs');

const program = new Command();

program
  .name('kmuc-hoster')
  .description('Anfängerfreundliche CLI zum Erstellen von Docker-Projekten mit Deploy-Scripts')
  .version('1.0.0');

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
  .description('Deployment-Helfer für bestehende Projekte')
  .option('-t, --type <type>', 'Deployment-Typ (vps|cloud|local)')
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

program.parse(process.argv);

// Zeige Hilfe wenn kein Befehl angegeben wurde
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log();
  console.log(chalk.cyan('💡 Tipp: Starte mit'), chalk.yellow('kmuc-hoster init'), chalk.cyan('um ein neues Projekt zu erstellen'));
}
