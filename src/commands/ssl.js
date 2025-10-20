const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const inquirer = require('inquirer').default || require('inquirer');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function sslStatusCommand(options) {
  console.log(chalk.cyan.bold('\n🔒 SSL Certificate Status\n'));

  try {
    // Check if SSL certificates exist
    const certsDir = '/etc/letsencrypt/live';
    const localCertsDir = './certs';

    let certificates = [];

    // Try to check Let's Encrypt certificates
    try {
      const { stdout } = await execAsync(`ls ${certsDir} 2>/dev/null || echo ""`);
      if (stdout.trim()) {
        const domains = stdout.trim().split('\n');
        for (const domain of domains) {
          if (domain && domain !== 'README') {
            const cert = await getCertificateInfo(path.join(certsDir, domain, 'fullchain.pem'));
            if (cert) {
              certificates.push({ domain, ...cert, source: 'Let\'s Encrypt' });
            }
          }
        }
      }
    } catch (error) {
      // Let's Encrypt certs might not exist
    }

    // Check local certificates
    try {
      await fs.access(localCertsDir);
      const files = await fs.readdir(localCertsDir);
      const certFiles = files.filter(f => f.endsWith('.pem') || f.endsWith('.crt'));

      for (const file of certFiles) {
        const certPath = path.join(localCertsDir, file);
        const cert = await getCertificateInfo(certPath);
        if (cert) {
          certificates.push({ domain: file, ...cert, source: 'Local' });
        }
      }
    } catch (error) {
      // Local certs might not exist
    }

    if (certificates.length === 0) {
      console.log(chalk.yellow('⚠️  Keine SSL Zertifikate gefunden\n'));
      console.log(chalk.gray('💡 Tipps:'));
      console.log(chalk.gray('   - Für VPS: Verwende scripts/setup-domain.sh'));
      console.log(chalk.gray('   - Für Let\'s Encrypt: certbot certonly --standalone\n'));
      return;
    }

    console.log(chalk.cyan.bold('📜 Zertifikate:\n'));

    for (const cert of certificates) {
      const daysUntilExpiry = Math.floor((new Date(cert.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));

      let statusColor;
      let statusIcon;

      if (daysUntilExpiry > 30) {
        statusColor = chalk.green;
        statusIcon = '✓';
      } else if (daysUntilExpiry > 0) {
        statusColor = chalk.yellow;
        statusIcon = '⚠';
      } else {
        statusColor = chalk.red;
        statusIcon = '✗';
      }

      console.log(statusColor(`${statusIcon} ${cert.domain}`));
      console.log(chalk.gray(`  Quelle: ${cert.source}`));
      console.log(chalk.gray(`  Ausgestellt: ${cert.issuedAt}`));
      console.log(chalk.gray(`  Läuft ab: ${cert.expiresAt} (${daysUntilExpiry} Tage)`));

      if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        console.log(chalk.yellow(`  ⚠️  Erneuere bald mit: kmuc ssl:renew`));
      } else if (daysUntilExpiry <= 0) {
        console.log(chalk.red(`  ✗ Abgelaufen! Erneuere mit: kmuc ssl:renew`));
      }

      console.log();
    }

  } catch (error) {
    console.error(chalk.red('❌ Fehler:'), error.message);
    console.log();
    process.exit(1);
  }
}

async function sslRenewCommand(options) {
  console.log(chalk.cyan.bold('\n🔄 SSL Certificate Renewal\n'));

  try {
    // Check if certbot is installed
    try {
      await execAsync('which certbot');
    } catch (error) {
      console.log(chalk.red('❌ Certbot ist nicht installiert!\n'));
      console.log(chalk.yellow('Installation:'));
      console.log(chalk.gray('  Ubuntu/Debian: apt-get install certbot'));
      console.log(chalk.gray('  CentOS/RHEL: yum install certbot'));
      console.log(chalk.gray('  macOS: brew install certbot\n'));
      process.exit(1);
    }

    const { method } = await inquirer.prompt([{
      type: 'list',
      name: 'method',
      message: 'Renewal-Methode wählen:',
      choices: [
        { name: 'Automatische Erneuerung (alle Zertifikate)', value: 'auto' },
        { name: 'Spezifische Domain erneuern', value: 'specific' },
        { name: 'Dry-Run Test', value: 'dryrun' }
      ]
    }]);

    let command;

    switch (method) {
      case 'auto':
        console.log();
        const spinner = ora('Erneuere Zertifikate...').start();

        try {
          const { stdout, stderr } = await execAsync('certbot renew --quiet');
          spinner.succeed('Zertifikate erneuert');

          if (stdout.includes('No renewals were attempted')) {
            console.log(chalk.yellow('\n⚠️  Keine Zertifikate mussten erneuert werden'));
            console.log(chalk.gray('Zertifikate werden erst 30 Tage vor Ablauf erneuert\n'));
          } else {
            console.log(chalk.green('\n✅ Zertifikate wurden erneuert!\n'));
            console.log(chalk.yellow('💡 Starte nginx neu:'));
            console.log(chalk.gray('   systemctl reload nginx\n'));
          }
        } catch (error) {
          spinner.fail('Erneuerung fehlgeschlagen');
          console.log(chalk.red('\n❌ Fehler:'), error.message);
          console.log();
        }
        break;

      case 'specific':
        const { domain } = await inquirer.prompt([{
          type: 'input',
          name: 'domain',
          message: 'Domain eingeben:',
          validate: input => input.length > 0 || 'Domain erforderlich'
        }]);

        console.log();
        const domainSpinner = ora(`Erneuere Zertifikat für ${domain}...`).start();

        try {
          await execAsync(`certbot certonly --standalone -d ${domain} --force-renewal`);
          domainSpinner.succeed(`Zertifikat für ${domain} erneuert`);

          console.log(chalk.green(`\n✅ Zertifikat für ${domain} erneuert!\n`));
          console.log(chalk.yellow('💡 Starte nginx neu:'));
          console.log(chalk.gray('   systemctl reload nginx\n'));
        } catch (error) {
          domainSpinner.fail('Erneuerung fehlgeschlagen');
          console.log(chalk.red('\n❌ Fehler:'), error.message);
          console.log();
        }
        break;

      case 'dryrun':
        console.log();
        const testSpinner = ora('Teste Erneuerung...').start();

        try {
          const { stdout } = await execAsync('certbot renew --dry-run');
          testSpinner.succeed('Dry-Run erfolgreich');

          console.log(chalk.green('\n✅ Test erfolgreich!'));
          console.log(chalk.gray('Die Erneuerung würde funktionieren.\n'));
        } catch (error) {
          testSpinner.fail('Test fehlgeschlagen');
          console.log(chalk.red('\n❌ Test fehlgeschlagen:'), error.message);
          console.log();
        }
        break;
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log();
    process.exit(1);
  }
}

async function sslAutoCommand(options) {
  console.log(chalk.cyan.bold('\n⚙️  SSL Auto-Renewal Setup\n'));

  try {
    // Check if certbot is installed
    try {
      await execAsync('which certbot');
    } catch (error) {
      console.log(chalk.red('❌ Certbot ist nicht installiert!\n'));
      console.log(chalk.yellow('Installation:'));
      console.log(chalk.gray('  Ubuntu/Debian: apt-get install certbot'));
      console.log(chalk.gray('  CentOS/RHEL: yum install certbot'));
      console.log(chalk.gray('  macOS: brew install certbot\n'));
      process.exit(1);
    }

    console.log(chalk.cyan('Automatische SSL-Erneuerung einrichten\n'));

    // Check if cron job already exists
    let cronExists = false;
    try {
      const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""');
      if (stdout.includes('certbot renew')) {
        cronExists = true;
      }
    } catch (error) {
      // Crontab might not exist yet
    }

    if (cronExists) {
      console.log(chalk.yellow('⚠️  Auto-Renewal ist bereits eingerichtet\n'));

      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Möchtest du die Konfiguration aktualisieren?',
        default: false
      }]);

      if (!overwrite) {
        console.log(chalk.gray('\nAbgebrochen\n'));
        return;
      }
    }

    const { schedule } = await inquirer.prompt([{
      type: 'list',
      name: 'schedule',
      message: 'Erneuerungs-Zeitplan:',
      choices: [
        { name: 'Täglich um 3:00 Uhr (empfohlen)', value: 'daily' },
        { name: 'Wöchentlich (Montag 3:00 Uhr)', value: 'weekly' },
        { name: 'Monatlich (1. des Monats 3:00 Uhr)', value: 'monthly' }
      ]
    }]);

    let cronSchedule;
    switch (schedule) {
      case 'daily':
        cronSchedule = '0 3 * * *';
        break;
      case 'weekly':
        cronSchedule = '0 3 * * 1';
        break;
      case 'monthly':
        cronSchedule = '0 3 1 * *';
        break;
    }

    // Create cron job
    const cronJob = `${cronSchedule} certbot renew --quiet && systemctl reload nginx`;

    console.log();
    const spinner = ora('Richte Cron-Job ein...').start();

    try {
      // Get existing crontab
      let existingCron = '';
      try {
        const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""');
        existingCron = stdout;
      } catch (error) {
        // No existing crontab
      }

      // Remove old certbot renew entries
      const lines = existingCron.split('\n').filter(line =>
        !line.includes('certbot renew')
      );

      // Add new cron job
      lines.push(cronJob);

      // Write new crontab
      const newCron = lines.filter(l => l.trim()).join('\n') + '\n';
      await execAsync(`echo "${newCron}" | crontab -`);

      spinner.succeed('Auto-Renewal eingerichtet');

      console.log();
      console.log(chalk.green.bold('✅ Automatische SSL-Erneuerung aktiviert!\n'));
      console.log(chalk.cyan('📋 Zeitplan:'), chalk.yellow(getScheduleDescription(schedule)));
      console.log(chalk.cyan('📝 Cron-Job:'), chalk.gray(cronJob));
      console.log();
      console.log(chalk.gray('💡 Überprüfe Cron-Jobs mit:'));
      console.log(chalk.gray('   crontab -l\n'));

    } catch (error) {
      spinner.fail('Setup fehlgeschlagen');
      throw error;
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log();
    process.exit(1);
  }
}

async function getCertificateInfo(certPath) {
  try {
    const { stdout } = await execAsync(
      `openssl x509 -in "${certPath}" -noout -dates -subject 2>/dev/null || echo ""`
    );

    if (!stdout.trim()) {
      return null;
    }

    const lines = stdout.split('\n');
    const notBefore = lines.find(l => l.startsWith('notBefore='))?.split('=')[1];
    const notAfter = lines.find(l => l.startsWith('notAfter='))?.split('=')[1];

    if (!notBefore || !notAfter) {
      return null;
    }

    return {
      issuedAt: new Date(notBefore).toLocaleDateString('de-DE'),
      expiresAt: new Date(notAfter).toLocaleDateString('de-DE')
    };
  } catch (error) {
    return null;
  }
}

function getScheduleDescription(schedule) {
  switch (schedule) {
    case 'daily':
      return 'Täglich um 3:00 Uhr';
    case 'weekly':
      return 'Wöchentlich (Montag 3:00 Uhr)';
    case 'monthly':
      return 'Monatlich (1. des Monats 3:00 Uhr)';
    default:
      return schedule;
  }
}

module.exports = { sslStatusCommand, sslRenewCommand, sslAutoCommand };
