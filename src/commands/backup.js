const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const inquirer = require('inquirer').default || require('inquirer');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function backupCommand(options) {
  console.log(chalk.cyan.bold('\n💾 KMUC Backup System\n'));

  try {
    // Check if docker-compose.yml exists
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    // Create backup directory if not exists
    const backupDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    // Ask what to do
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Was möchtest du tun?',
      choices: [
        { name: 'Neues Backup erstellen', value: 'create' },
        { name: 'Backup wiederherstellen', value: 'restore' },
        { name: 'Backups auflisten', value: 'list' },
        { name: 'Backup löschen', value: 'delete' }
      ]
    }]);

    switch (action) {
      case 'create':
        await createBackup(backupDir);
        break;
      case 'restore':
        await restoreBackup(backupDir);
        break;
      case 'list':
        await listBackups(backupDir);
        break;
      case 'delete':
        await deleteBackup(backupDir);
        break;
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log();
    process.exit(1);
  }
}

async function createBackup(backupDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupName = `backup-${timestamp}`;
  const backupPath = path.join(backupDir, backupName);

  console.log();
  const spinner = ora('Erstelle Backup...').start();

  try {
    // Create backup subdirectory
    await fs.mkdir(backupPath, { recursive: true });

    // 1. Backup docker-compose.yml
    await fs.copyFile('docker-compose.yml', path.join(backupPath, 'docker-compose.yml'));

    // 2. Backup .env if exists
    try {
      await fs.copyFile('.env', path.join(backupPath, '.env'));
    } catch (error) {
      // .env might not exist
    }

    // 3. Backup Dockerfile if exists
    try {
      await fs.copyFile('Dockerfile', path.join(backupPath, 'Dockerfile'));
    } catch (error) {
      // Dockerfile might not exist
    }

    // 4. Get list of volumes
    const composeContent = await fs.readFile('docker-compose.yml', 'utf8');
    const volumes = extractVolumes(composeContent);

    // 5. Backup database if present
    const dbInfo = detectDatabase(composeContent);
    if (dbInfo) {
      spinner.text = `Erstelle ${dbInfo.name} Dump...`;
      await backupDatabase(dbInfo, backupPath);
    }

    // 6. Export volumes as tarballs
    if (volumes.length > 0) {
      spinner.text = 'Exportiere Volumes...';
      for (const volume of volumes) {
        await backupVolume(volume, backupPath);
      }
    }

    // 7. Create metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      name: backupName,
      database: dbInfo ? dbInfo.type : null,
      volumes: volumes,
      files: ['docker-compose.yml', 'Dockerfile', '.env']
    };

    await fs.writeFile(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    spinner.succeed('Backup erstellt');

    console.log();
    console.log(chalk.green.bold('✅ Backup erfolgreich erstellt!\n'));
    console.log(chalk.cyan('📂 Speicherort:'), chalk.yellow(backupPath));
    console.log();
    console.log(chalk.gray('💡 Wiederherstellen mit:'));
    console.log(chalk.gray('   kmuc backup'), chalk.dim('→ Backup wiederherstellen\n'));

  } catch (error) {
    spinner.fail('Backup fehlgeschlagen');
    throw error;
  }
}

async function restoreBackup(backupDir) {
  const backups = await getBackupList(backupDir);

  if (backups.length === 0) {
    console.log(chalk.yellow('\n⚠️  Keine Backups gefunden\n'));
    return;
  }

  const { selectedBackup } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedBackup',
    message: 'Welches Backup wiederherstellen?',
    choices: backups.map(b => ({
      name: `${b.name} (${b.date})`,
      value: b.path
    }))
  }]);

  // Confirm
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: chalk.yellow('⚠️  Aktuelle Daten werden überschrieben. Fortfahren?'),
    default: false
  }]);

  if (!confirm) {
    console.log(chalk.gray('\nWiederherstellung abgebrochen\n'));
    return;
  }

  console.log();
  const spinner = ora('Stelle Backup wieder her...').start();

  try {
    // Stop containers
    spinner.text = 'Stoppe Container...';
    try {
      await execAsync('docker-compose down');
    } catch (error) {
      // Containers might not be running
    }

    // Restore configuration files
    const files = ['docker-compose.yml', 'Dockerfile', '.env'];
    for (const file of files) {
      const sourcePath = path.join(selectedBackup, file);
      try {
        await fs.copyFile(sourcePath, path.join(process.cwd(), file));
      } catch (error) {
        // File might not exist in backup
      }
    }

    // Read metadata
    const metadataPath = path.join(selectedBackup, 'metadata.json');
    let metadata = null;
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      // Metadata might not exist in older backups
    }

    // Restore database dump
    if (metadata && metadata.database) {
      spinner.text = 'Stelle Datenbank wieder her...';
      await restoreDatabase(metadata.database, selectedBackup);
    }

    // Restore volumes
    if (metadata && metadata.volumes && metadata.volumes.length > 0) {
      spinner.text = 'Stelle Volumes wieder her...';
      for (const volume of metadata.volumes) {
        await restoreVolume(volume, selectedBackup);
      }
    }

    // Start containers
    spinner.text = 'Starte Container...';
    await execAsync('docker-compose up -d');

    spinner.succeed('Backup wiederhergestellt');

    console.log();
    console.log(chalk.green.bold('✅ Backup erfolgreich wiederhergestellt!\n'));

  } catch (error) {
    spinner.fail('Wiederherstellung fehlgeschlagen');
    throw error;
  }
}

async function listBackups(backupDir) {
  const backups = await getBackupList(backupDir);

  if (backups.length === 0) {
    console.log(chalk.yellow('\n⚠️  Keine Backups gefunden\n'));
    return;
  }

  console.log();
  console.log(chalk.cyan.bold('📦 Verfügbare Backups:\n'));

  for (const backup of backups) {
    console.log(chalk.yellow(`  ${backup.name}`));
    console.log(chalk.gray(`    Datum: ${backup.date}`));
    console.log(chalk.gray(`    Größe: ${backup.size}`));
    console.log(chalk.gray(`    Pfad: ${backup.path}`));
    console.log();
  }
}

async function deleteBackup(backupDir) {
  const backups = await getBackupList(backupDir);

  if (backups.length === 0) {
    console.log(chalk.yellow('\n⚠️  Keine Backups gefunden\n'));
    return;
  }

  const { selectedBackup } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedBackup',
    message: 'Welches Backup löschen?',
    choices: backups.map(b => ({
      name: `${b.name} (${b.date})`,
      value: b.path
    }))
  }]);

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: chalk.yellow('Backup wirklich löschen?'),
    default: false
  }]);

  if (!confirm) {
    console.log(chalk.gray('\nLöschen abgebrochen\n'));
    return;
  }

  try {
    await fs.rm(selectedBackup, { recursive: true, force: true });
    console.log(chalk.green('\n✅ Backup gelöscht\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Löschen fehlgeschlagen:'), error.message, '\n');
  }
}

async function getBackupList(backupDir) {
  try {
    const entries = await fs.readdir(backupDir);
    const backups = [];

    for (const entry of entries) {
      const backupPath = path.join(backupDir, entry);
      const stat = await fs.stat(backupPath);

      if (stat.isDirectory() && entry.startsWith('backup-')) {
        const size = await getDirectorySize(backupPath);
        backups.push({
          name: entry,
          date: stat.mtime.toLocaleString('de-DE'),
          size: formatBytes(size),
          path: backupPath
        });
      }
    }

    return backups.sort((a, b) => b.name.localeCompare(a.name));
  } catch (error) {
    return [];
  }
}

async function backupDatabase(dbInfo, backupPath) {
  const dumpFile = path.join(backupPath, `${dbInfo.type}-dump.sql`);

  try {
    switch (dbInfo.type) {
      case 'postgres':
        await execAsync(
          `docker-compose exec -T ${dbInfo.service} pg_dumpall -U postgres > "${dumpFile}"`
        );
        break;

      case 'mysql':
        await execAsync(
          `docker-compose exec -T ${dbInfo.service} mysqldump --all-databases -u root > "${dumpFile}"`
        );
        break;

      case 'mongodb':
        const mongoBackupPath = path.join(backupPath, 'mongodb-dump');
        await execAsync(
          `docker-compose exec -T ${dbInfo.service} mongodump --archive > "${mongoBackupPath}"`
        );
        break;
    }
  } catch (error) {
    // Database backup might fail if container is not running
    console.log(chalk.yellow('⚠️  Datenbank-Dump übersprungen (Container läuft nicht)'));
  }
}

async function restoreDatabase(dbType, backupPath) {
  try {
    switch (dbType) {
      case 'postgres':
        const pgDump = path.join(backupPath, 'postgres-dump.sql');
        await execAsync(
          `docker-compose exec -T postgres psql -U postgres < "${pgDump}"`
        );
        break;

      case 'mysql':
        const mysqlDump = path.join(backupPath, 'mysql-dump.sql');
        await execAsync(
          `docker-compose exec -T mysql mysql -u root < "${mysqlDump}"`
        );
        break;

      case 'mongodb':
        const mongoDump = path.join(backupPath, 'mongodb-dump');
        await execAsync(
          `docker-compose exec -T mongodb mongorestore --archive < "${mongoDump}"`
        );
        break;
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Datenbank-Wiederherstellung fehlgeschlagen'));
  }
}

async function backupVolume(volumeName, backupPath) {
  try {
    const tarFile = path.join(backupPath, `${volumeName}.tar`);
    await execAsync(
      `docker run --rm -v ${volumeName}:/data -v "${backupPath}":/backup alpine tar -czf /backup/${volumeName}.tar.gz -C /data .`
    );
  } catch (error) {
    // Volume backup might fail
  }
}

async function restoreVolume(volumeName, backupPath) {
  try {
    const tarFile = path.join(backupPath, `${volumeName}.tar.gz`);
    await execAsync(
      `docker run --rm -v ${volumeName}:/data -v "${backupPath}":/backup alpine tar -xzf /backup/${volumeName}.tar.gz -C /data`
    );
  } catch (error) {
    // Volume restore might fail
  }
}

function extractVolumes(composeContent) {
  const volumes = [];
  const volumeRegex = /volumes:\s*\n\s*-\s*([a-zA-Z0-9_-]+):/g;
  let match;

  while ((match = volumeRegex.exec(composeContent)) !== null) {
    if (!volumes.includes(match[1])) {
      volumes.push(match[1]);
    }
  }

  return volumes;
}

function detectDatabase(composeContent) {
  const databases = [
    { type: 'postgres', service: 'postgres', name: 'PostgreSQL', image: 'postgres' },
    { type: 'mongodb', service: 'mongodb', name: 'MongoDB', image: 'mongo' },
    { type: 'mysql', service: 'mysql', name: 'MySQL', image: 'mysql' },
    { type: 'redis', service: 'redis', name: 'Redis', image: 'redis' }
  ];

  for (const db of databases) {
    if (composeContent.includes(`image: ${db.image}`) ||
        composeContent.includes(`${db.service}:`)) {
      return db;
    }
  }

  return null;
}

async function getDirectorySize(dirPath) {
  let size = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        size += stat.size;
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function checkFile(filename) {
  try {
    await fs.access(path.join(process.cwd(), filename));
    return true;
  } catch {
    return false;
  }
}

module.exports = { backupCommand };
