const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function deployCommand(options) {
  console.log(chalk.cyan.bold('\n📦 KMUC Deploy\n'));

  try {
    // Check if deploy.sh exists
    const deployScriptPath = path.join(process.cwd(), 'scripts', 'deploy.sh');

    try {
      await fs.access(deployScriptPath);
    } catch (error) {
      console.error(chalk.red('❌ Kein Deploy-Script gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus und wähle VPS/Cloud Deployment\n'));
      process.exit(1);
    }

    // Detect deployment target from script
    const deployScript = await fs.readFile(deployScriptPath, 'utf8');
    const hasServerConfig = deployScript.includes('SERVER_IP') && deployScript.includes('SERVER_USER');

    if (!hasServerConfig) {
      console.error(chalk.red('❌ Deploy-Script ist nicht für VPS/Server konfiguriert!'));
      console.log(chalk.yellow('💡 Für lokales Deployment nutze:'), chalk.gray('kmuc publish\n'));
      process.exit(1);
    }

    // Extract server config from script
    const serverIPMatch = deployScript.match(/SERVER_IP="([^"]+)"/);
    const serverUserMatch = deployScript.match(/SERVER_USER="([^"]+)"/);
    const serverPortMatch = deployScript.match(/SERVER_PORT="([^"]+)"/);

    const serverIP = serverIPMatch ? serverIPMatch[1] : null;
    const serverUser = serverUserMatch ? serverUserMatch[1] : null;
    const serverPort = serverPortMatch ? serverPortMatch[1] : '22';

    if (!serverIP || !serverUser) {
      console.error(chalk.red('❌ Server-Konfiguration unvollständig!'));
      console.log(chalk.yellow('💡 Prüfe SERVER_IP und SERVER_USER in scripts/deploy.sh\n'));
      process.exit(1);
    }

    // Validate server connection
    console.log(chalk.cyan.bold('🔍 Validiere Server-Verbindung...\n'));
    const validationSpinner = ora(`Prüfe Verbindung zu ${serverUser}@${serverIP}:${serverPort}...`).start();

    try {
      // Test SSH connection (without BatchMode to allow password)
      await execAsync(`ssh -p ${serverPort} -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new ${serverUser}@${serverIP} "echo 'Connection successful'" < /dev/null`, {
        timeout: 15000
      });
      validationSpinner.succeed(`Server erreichbar: ${serverUser}@${serverIP}`);
    } catch (error) {
      // If connection test fails, warn but continue (might work with password in deploy.sh)
      validationSpinner.warn('SSH-Verbindung konnte nicht validiert werden');
      console.log();
      console.log(chalk.yellow('⚠️  Verbindungstest fehlgeschlagen, versuche trotzdem zu deployen...'));
      console.log(chalk.gray('   (Passwort-Authentifizierung wird im Deploy-Script unterstützt)\n'));
    }

    console.log();

    // Execute deployment
    console.log(chalk.cyan.bold('🚀 Starte VPS Deployment...\n'));

    const deploySpinner = ora('Deploye auf Server...').start();

    try {
      // Check if bash is available
      try {
        await execAsync('bash --version');
      } catch (error) {
        deploySpinner.fail('Bash nicht gefunden!');
        console.log();
        console.log(chalk.red('❌ Bash ist nicht installiert oder nicht im PATH'));
        console.log();
        console.log(chalk.yellow('💡 Installiere Git Bash oder WSL:'));
        if (process.platform === 'win32') {
          console.log(chalk.gray('   • Git Bash: https://git-scm.com/downloads'));
          console.log(chalk.gray('   • WSL: wsl --install (in PowerShell)\n'));
        }
        process.exit(1);
      }

      // Make script executable (only on Unix systems)
      if (process.platform !== 'win32') {
        await execAsync(`chmod +x "${deployScriptPath}"`);
      }

      // Execute deploy script
      const { exec: execWithOutput } = require('child_process');

      // Use relative path for better compatibility
      const scriptPath = './scripts/deploy.sh';

      const deployProcess = execWithOutput(`bash "${scriptPath}"`, {
        cwd: process.cwd(),
        shell: true
      });

      // Stream output
      deployProcess.stdout.on('data', (data) => {
        deploySpinner.stop();
        process.stdout.write(data);
      });

      deployProcess.stderr.on('data', (data) => {
        deploySpinner.stop();
        process.stderr.write(data);
      });

      // Wait for completion
      await new Promise((resolve, reject) => {
        deployProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Deploy-Script beendet mit Code ${code}`));
          }
        });
      });

      console.log();
      console.log(chalk.green.bold('✅ Deployment erfolgreich!\n'));

    } catch (error) {
      deploySpinner.fail('Deployment fehlgeschlagen');
      console.log();
      console.log(chalk.red('❌ Fehler:'), error.message);
      console.log();
      console.log(chalk.yellow('💡 Du kannst das Script auch manuell ausführen:'));
      console.log(chalk.gray('   ./scripts/deploy.sh\n'));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    process.exit(1);
  }
}

module.exports = { deployCommand };
