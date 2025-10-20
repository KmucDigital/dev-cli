const chalk = require('chalk').default || require('chalk');
const inquirer = require('inquirer').default || require('inquirer');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function cleanCommand(options) {
  console.log(chalk.cyan.bold('\n🧹 KMUC Hoster Clean\n'));

  const all = options.all || false;

  try {
    // Ask what to clean
    const { cleanOptions } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'cleanOptions',
      message: 'Was möchtest du aufräumen?',
      choices: [
        { name: 'Stopped Containers', value: 'containers', checked: true },
        { name: 'Dangling Images (untagged)', value: 'images', checked: true },
        { name: 'Unused Volumes', value: 'volumes', checked: false },
        { name: 'Build Cache', value: 'cache', checked: false },
        { name: 'Alle ungenutzten Ressourcen', value: 'system', checked: false }
      ]
    }]);

    if (cleanOptions.length === 0) {
      console.log(chalk.gray('\nNichts zum Aufräumen ausgewählt\n'));
      return;
    }

    // Show what will be cleaned
    console.log();
    let totalSize = 0;

    for (const option of cleanOptions) {
      if (option === 'system') {
        const { stdout } = await execAsync('docker system df');
        console.log(chalk.yellow('System Übersicht:\n'));
        console.log(stdout);
      }
    }

    // Confirm
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow('Möchtest du wirklich fortfahren?'),
      default: false
    }]);

    if (!confirm) {
      console.log(chalk.gray('\nAufräumen abgebrochen\n'));
      return;
    }

    // Clean
    console.log();
    for (const option of cleanOptions) {
      try {
        let cmd;
        let msg;

        switch (option) {
          case 'containers':
            cmd = 'docker container prune -f';
            msg = 'Stopped Container entfernt';
            break;
          case 'images':
            cmd = 'docker image prune -f';
            msg = 'Dangling Images entfernt';
            break;
          case 'volumes':
            cmd = 'docker volume prune -f';
            msg = 'Ungenutzte Volumes entfernt';
            break;
          case 'cache':
            cmd = 'docker builder prune -f';
            msg = 'Build Cache geleert';
            break;
          case 'system':
            cmd = 'docker system prune -f';
            msg = 'System aufgeräumt';
            break;
        }

        const { stdout } = await execAsync(cmd);
        console.log(chalk.green('✓ ' + msg));
        if (stdout.includes('Total reclaimed space:')) {
          console.log(chalk.gray('  ' + stdout.match(/Total reclaimed space: .*/)[0]));
        }
      } catch (error) {
        console.log(chalk.red('✗ Fehler bei: ' + option));
      }
    }

    console.log();
    console.log(chalk.green.bold('✅ Aufräumen abgeschlossen!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    process.exit(1);
  }
}

module.exports = { cleanCommand };
