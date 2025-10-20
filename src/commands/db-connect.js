const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const { spawn } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function dbConnectCommand(options) {
  console.log(chalk.cyan.bold('\n🗄️  KMUC Database Connect\n'));

  try {
    // Check if docker-compose.yml exists
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    // Read docker-compose.yml
    const composeContent = await fs.readFile('docker-compose.yml', 'utf8');

    // Detect database
    const spinner = ora('Erkenne Datenbank...').start();
    const dbInfo = detectDatabase(composeContent);

    if (!dbInfo) {
      spinner.fail('Keine Datenbank gefunden');
      console.log(chalk.yellow('\n💡 Verfügbare Datenbanken in docker-compose.yml:'));
      console.log(chalk.gray('   - postgres'));
      console.log(chalk.gray('   - mongodb'));
      console.log(chalk.gray('   - mysql'));
      console.log(chalk.gray('   - redis\n'));
      process.exit(1);
    }

    spinner.succeed(`${dbInfo.name} erkannt`);

    // Check if container is running
    const runningSpinner = ora('Prüfe Container Status...').start();
    try {
      const { stdout } = await execAsync(`docker-compose ps ${dbInfo.service}`);
      if (!stdout.includes('Up')) {
        runningSpinner.fail('Container läuft nicht');
        console.log(chalk.yellow('\n💡 Starte Container mit:'));
        console.log(chalk.gray('   kmuc publish'), chalk.dim('oder'));
        console.log(chalk.gray('   docker-compose up -d\n'));
        process.exit(1);
      }
      runningSpinner.succeed('Container läuft');
    } catch (error) {
      runningSpinner.fail('Container nicht gefunden');
      process.exit(1);
    }

    // Read credentials from .env if exists
    let credentials = await loadCredentials(dbInfo.type);

    console.log();
    console.log(chalk.cyan('🔌 Verbinde mit'), chalk.yellow(dbInfo.name));
    console.log();

    // Connect based on database type
    await connectToDatabase(dbInfo, credentials);

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log();
    process.exit(1);
  }
}

function detectDatabase(composeContent) {
  const databases = [
    {
      type: 'postgres',
      service: 'postgres',
      name: 'PostgreSQL',
      image: 'postgres',
      client: 'psql',
      defaultPort: 5432
    },
    {
      type: 'mongodb',
      service: 'mongodb',
      name: 'MongoDB',
      image: 'mongo',
      client: 'mongosh',
      defaultPort: 27017
    },
    {
      type: 'mysql',
      service: 'mysql',
      name: 'MySQL',
      image: 'mysql',
      client: 'mysql',
      defaultPort: 3306
    },
    {
      type: 'redis',
      service: 'redis',
      name: 'Redis',
      image: 'redis',
      client: 'redis-cli',
      defaultPort: 6379
    }
  ];

  for (const db of databases) {
    if (composeContent.includes(`image: ${db.image}`) ||
        composeContent.includes(`${db.service}:`)) {
      return db;
    }
  }

  return null;
}

async function loadCredentials(dbType) {
  try {
    const envContent = await fs.readFile('.env', 'utf8');
    const credentials = {};

    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/['"]/g, '');

        if (key && value) {
          credentials[key.trim()] = value.trim();
        }
      }
    }

    return credentials;
  } catch (error) {
    return {};
  }
}

async function connectToDatabase(dbInfo, credentials) {
  let command, args;

  switch (dbInfo.type) {
    case 'postgres':
      const pgDb = credentials.POSTGRES_DB || credentials.DB_NAME || 'postgres';
      const pgUser = credentials.POSTGRES_USER || 'postgres';

      command = 'docker-compose';
      args = ['exec', dbInfo.service, 'psql', '-U', pgUser, '-d', pgDb];

      console.log(chalk.gray(`   Database: ${pgDb}`));
      console.log(chalk.gray(`   User: ${pgUser}`));
      console.log(chalk.gray(`   Container: ${dbInfo.service}`));
      console.log();
      console.log(chalk.cyan('💡 Nützliche PostgreSQL Befehle:'));
      console.log(chalk.gray('   \\dt        - Liste alle Tabellen'));
      console.log(chalk.gray('   \\l         - Liste alle Datenbanken'));
      console.log(chalk.gray('   \\q         - Beenden'));
      break;

    case 'mongodb':
      const mongoDb = credentials.MONGO_INITDB_DATABASE || credentials.DB_NAME || 'admin';
      const mongoUser = credentials.MONGO_INITDB_ROOT_USERNAME || 'root';
      const mongoPass = credentials.MONGO_INITDB_ROOT_PASSWORD || '';

      command = 'docker-compose';
      args = ['exec', dbInfo.service, 'mongosh'];

      if (mongoUser && mongoPass) {
        args.push('-u', mongoUser, '-p', mongoPass, '--authenticationDatabase', 'admin');
      }

      if (mongoDb !== 'admin') {
        args.push(mongoDb);
      }

      console.log(chalk.gray(`   Database: ${mongoDb}`));
      console.log(chalk.gray(`   User: ${mongoUser}`));
      console.log(chalk.gray(`   Container: ${dbInfo.service}`));
      console.log();
      console.log(chalk.cyan('💡 Nützliche MongoDB Befehle:'));
      console.log(chalk.gray('   show dbs           - Liste alle Datenbanken'));
      console.log(chalk.gray('   show collections   - Liste alle Collections'));
      console.log(chalk.gray('   exit               - Beenden'));
      break;

    case 'mysql':
      const mysqlDb = credentials.MYSQL_DATABASE || credentials.DB_NAME || 'mysql';
      const mysqlUser = credentials.MYSQL_USER || 'root';
      const mysqlPass = credentials.MYSQL_ROOT_PASSWORD || credentials.MYSQL_PASSWORD || '';

      command = 'docker-compose';
      args = ['exec', dbInfo.service, 'mysql', '-u', mysqlUser];

      if (mysqlPass) {
        args.push(`-p${mysqlPass}`);
      }

      args.push(mysqlDb);

      console.log(chalk.gray(`   Database: ${mysqlDb}`));
      console.log(chalk.gray(`   User: ${mysqlUser}`));
      console.log(chalk.gray(`   Container: ${dbInfo.service}`));
      console.log();
      console.log(chalk.cyan('💡 Nützliche MySQL Befehle:'));
      console.log(chalk.gray('   SHOW TABLES;       - Liste alle Tabellen'));
      console.log(chalk.gray('   SHOW DATABASES;    - Liste alle Datenbanken'));
      console.log(chalk.gray('   exit;              - Beenden'));
      break;

    case 'redis':
      command = 'docker-compose';
      args = ['exec', dbInfo.service, 'redis-cli'];

      console.log(chalk.gray(`   Container: ${dbInfo.service}`));
      console.log();
      console.log(chalk.cyan('💡 Nützliche Redis Befehle:'));
      console.log(chalk.gray('   KEYS *         - Liste alle Keys'));
      console.log(chalk.gray('   INFO           - Server Info'));
      console.log(chalk.gray('   exit           - Beenden'));
      break;

    default:
      throw new Error(`Nicht unterstützter Datenbanktyp: ${dbInfo.type}`);
  }

  console.log();
  console.log(chalk.green('✅ Verbunden! Drücke Ctrl+D zum Beenden\n'));

  // Spawn interactive process
  const dbProcess = spawn(command, args, {
    stdio: 'inherit',
    shell: true
  });

  return new Promise((resolve, reject) => {
    dbProcess.on('exit', (code) => {
      console.log();
      if (code === 0) {
        console.log(chalk.cyan('👋 Verbindung beendet\n'));
        resolve();
      } else {
        console.log(chalk.yellow('⚠️  Verbindung beendet mit Code:'), code, '\n');
        resolve();
      }
    });

    dbProcess.on('error', (error) => {
      console.error(chalk.red('\n❌ Verbindungsfehler:'), error.message, '\n');
      reject(error);
    });
  });
}

async function checkFile(filename) {
  try {
    await fs.access(path.join(process.cwd(), filename));
    return true;
  } catch {
    return false;
  }
}

module.exports = { dbConnectCommand };
