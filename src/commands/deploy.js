const chalk = require('chalk').default || require('chalk');

async function deployCommand(options) {
  console.log(chalk.cyan.bold('\n📦 Deploy Helfer\n'));

  const deployType = options.type || 'local';

  switch (deployType) {
    case 'local':
      console.log(chalk.yellow('🏠 Lokales Deployment:'));
      console.log('   docker-compose up -d');
      break;

    case 'vps':
      console.log(chalk.yellow('🖥️  VPS Deployment:'));
      console.log('   ./scripts/deploy.sh');
      console.log();
      console.log(chalk.gray('   Stelle sicher, dass du SSH-Zugriff hast und die'));
      console.log(chalk.gray('   Zugangsdaten in deploy.sh konfiguriert sind.'));
      break;

    case 'cloud':
      console.log(chalk.yellow('☁️  Cloud Deployment:'));
      console.log('   ./scripts/deploy-cloud.sh');
      console.log();
      console.log(chalk.gray('   Folge den Anweisungen für deinen Cloud Provider.'));
      break;

    default:
      console.log(chalk.red('❌ Unbekannter Deployment-Typ:'), deployType);
      console.log();
      console.log(chalk.gray('Verfügbare Typen: local, vps, cloud'));
      process.exit(1);
  }

  console.log();
  console.log(chalk.cyan('💡 Tipp:'), 'Nutze', chalk.yellow('./scripts/docker-helpers.sh'), 'für weitere Docker-Befehle');
}

module.exports = { deployCommand };
