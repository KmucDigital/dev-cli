const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const inquirer = require('inquirer').default || require('inquirer');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function updateCommand(options) {
  console.log(chalk.cyan.bold('\n🔄 KMUC Hoster Update\n'));

  const force = options.force || false;

  try {
    // Prüfe ob docker-compose.yml existiert
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc-hoster init" aus\n'));
      process.exit(1);
    }

    // 1. Prüfe welche Images verwendet werden
    const spinner = ora('Analysiere verwendete Images...').start();
    const composeContent = await fs.readFile('docker-compose.yml', 'utf8');
    const images = extractImages(composeContent);

    if (images.length === 0) {
      spinner.fail('Keine externen Images gefunden');
      console.log(chalk.gray('Projekt verwendet nur lokale Builds\n'));
      return;
    }

    spinner.succeed(`${images.length} Image(s) gefunden`);

    // 2. Prüfe Updates für jedes Image
    console.log();
    const updates = [];

    for (const image of images) {
      const checkSpinner = ora(`Prüfe ${image}...`).start();

      try {
        // Get current digest
        const { stdout: inspectOut } = await execAsync(`docker image inspect ${image} --format "{{.RepoDigests}}"`);
        const currentDigest = inspectOut.trim();

        // Pull latest to check for updates
        await execAsync(`docker pull ${image}`, { stdio: 'pipe' });

        // Get new digest
        const { stdout: newInspectOut } = await execAsync(`docker image inspect ${image} --format "{{.RepoDigests}}"`);
        const newDigest = newInspectOut.trim();

        if (currentDigest !== newDigest || force) {
          checkSpinner.succeed(`${image} - Update verfügbar`);
          updates.push({ image, hasUpdate: true });
        } else {
          checkSpinner.succeed(`${image} - Aktuell`);
          updates.push({ image, hasUpdate: false });
        }
      } catch (error) {
        checkSpinner.warn(`${image} - Konnte nicht geprüft werden`);
        updates.push({ image, hasUpdate: false, error: true });
      }
    }

    // 3. Zeige Update-Summary
    const availableUpdates = updates.filter(u => u.hasUpdate);

    if (availableUpdates.length === 0) {
      console.log();
      console.log(chalk.green('✅ Alle Images sind aktuell!\n'));
      return;
    }

    console.log();
    console.log(chalk.yellow(`📦 ${availableUpdates.length} Update(s) verfügbar:\n`));
    availableUpdates.forEach(u => {
      console.log(chalk.gray('  • ') + chalk.white(u.image));
    });

    // 4. Frage ob Update durchgeführt werden soll
    console.log();
    const { shouldUpdate } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldUpdate',
      message: 'Updates jetzt installieren?',
      default: true
    }]);

    if (!shouldUpdate) {
      console.log(chalk.gray('\nUpdate abgebrochen\n'));
      return;
    }

    // 5. Erstelle Backup vor Update
    const backupSpinner = ora('Erstelle Backup...').start();
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const backupName = `pre-update-${timestamp}`;

      await execAsync(`docker-compose config > backups/${backupName}-compose.yml`);

      backupSpinner.succeed(`Backup erstellt: backups/${backupName}-compose.yml`);
    } catch (error) {
      backupSpinner.warn('Backup fehlgeschlagen - fahre trotzdem fort');
    }

    // 6. Führe Update durch
    console.log();
    const updateSpinner = ora('Aktualisiere Container...').start();

    try {
      // Stop containers
      await execAsync('docker-compose down');

      // Pull new images (bereits gemacht, aber sicher ist sicher)
      for (const update of availableUpdates) {
        await execAsync(`docker pull ${update.image}`);
      }

      // Start with new images
      await execAsync('docker-compose up -d');

      updateSpinner.succeed('Container erfolgreich aktualisiert');

      // 7. Prüfe ob alles läuft
      console.log();
      const healthSpinner = ora('Prüfe Container Status...').start();

      await new Promise(resolve => setTimeout(resolve, 3000)); // Warte 3 Sekunden

      const { stdout: psOut } = await execAsync('docker-compose ps --format json');
      const containers = psOut.trim().split('\n').map(line => JSON.parse(line));
      const running = containers.filter(c => c.State === 'running').length;

      if (running === containers.length) {
        healthSpinner.succeed(`Alle ${running} Container laufen`);
      } else {
        healthSpinner.warn(`${running}/${containers.length} Container laufen`);
        console.log(chalk.yellow('\n⚠️  Einige Container laufen nicht korrekt'));
        console.log(chalk.gray('   Prüfe Logs mit: kmuc-hoster logs\n'));
      }

      console.log();
      console.log(chalk.green.bold('✅ Update erfolgreich abgeschlossen!\n'));
      console.log(chalk.gray('💡 Prüfe mit:'), chalk.yellow('kmuc-hoster status'));
      console.log();

    } catch (error) {
      updateSpinner.fail('Update fehlgeschlagen');
      console.log();
      console.log(chalk.red('❌ Fehler beim Update:\n'));
      console.log(chalk.gray(error.message));
      console.log();
      console.log(chalk.yellow('💡 Rollback mit:'));
      console.log(chalk.gray('   docker-compose up -d\n'));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    process.exit(1);
  }
}

function extractImages(composeContent) {
  const images = [];
  const lines = composeContent.split('\n');

  for (const line of lines) {
    // Suche nach "image: xyz" Zeilen
    const imageMatch = line.match(/^\s*image:\s*(.+)$/);
    if (imageMatch) {
      const image = imageMatch[1].trim().replace(/["']/g, '');
      // Nur externe Images, keine lokalen Builds
      if (!image.startsWith('${') && image.includes('/') || image.includes(':')) {
        images.push(image);
      }
    }
  }

  // Entferne Duplikate
  return [...new Set(images)];
}

async function checkFile(filename) {
  try {
    await fs.access(path.join(process.cwd(), filename));
    return true;
  } catch {
    return false;
  }
}

module.exports = { updateCommand };
