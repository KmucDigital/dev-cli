const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const inquirer = require('inquirer').default || require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const FormData = require('form-data');
const AdmZip = require('adm-zip');

const execAsync = promisify(exec);
const https = require('https');
const http = require('http');

const HOSTING_URL = process.env.KMUC_HOSTING_URL || 'https://hg.kmuc.online';

async function uploadCommand(projectName, options) {
  console.log(chalk.cyan.bold('\n🚀 KMUC Upload\n'));

  try {
    // Check if project name is provided
    if (!projectName) {
      const { name } = await inquirer.prompt([{
        type: 'input',
        name: 'name',
        message: 'Projekt-Name (für Subdomain):',
        validate: input => {
          if (!input) return 'Name erforderlich';
          if (!/^[a-z0-9-]+$/.test(input)) {
            return 'Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt';
          }
          return true;
        }
      }]);
      projectName = name;
    }

    // Validate project name
    if (!/^[a-z0-9-]+$/.test(projectName)) {
      console.error(chalk.red('❌ Ungültiger Projekt-Name!'));
      console.log(chalk.yellow('💡 Verwende nur Kleinbuchstaben, Zahlen und Bindestriche\n'));
      process.exit(1);
    }

    // Check for upload token
    let uploadToken = process.env.KMUC_UPLOAD_TOKEN;

    if (!uploadToken) {
      console.log(chalk.yellow('⚠️  KMUC_UPLOAD_TOKEN nicht gesetzt'));
      const { token } = await inquirer.prompt([{
        type: 'password',
        name: 'token',
        message: 'Upload Token:',
        validate: input => input.length > 0 || 'Token erforderlich'
      }]);
      uploadToken = token;

      // Ask to save token
      const { save } = await inquirer.prompt([{
        type: 'confirm',
        name: 'save',
        message: 'Token für zukünftige Uploads speichern?',
        default: true
      }]);

      if (save) {
        console.log();
        console.log(chalk.cyan('💡 Füge folgende Zeile zu deiner .bashrc / .zshrc hinzu:'));
        console.log(chalk.gray(`   export KMUC_UPLOAD_TOKEN="${token}"`));
        console.log();
      }
    }

    // Detect what to upload
    console.log();
    const uploadPath = await detectUploadPath();

    if (!uploadPath) {
      console.error(chalk.red('❌ Keine Dateien zum Upload gefunden!'));
      console.log(chalk.yellow('💡 Stell sicher, dass du in einem Projekt-Verzeichnis bist\n'));
      process.exit(1);
    }

    console.log(chalk.cyan('📦 Upload Quelle:'), chalk.yellow(uploadPath));
    console.log();

    // Create zip file
    const zipSpinner = ora('Erstelle Archiv...').start();
    const zipPath = await createZip(uploadPath, projectName);
    const zipSize = (await fs.stat(zipPath)).size;
    zipSpinner.succeed(`Archiv erstellt (${formatBytes(zipSize)})`);

    // Upload to server
    const uploadSpinner = ora('Uploade Projekt...').start();

    try {
      const response = await uploadToServer(zipPath, projectName, uploadToken);

      if (response.success) {
        uploadSpinner.succeed('Projekt hochgeladen');

        console.log();
        console.log(chalk.green.bold('✅ Deployment erfolgreich!\n'));
        console.log(chalk.cyan('🌐 Deine Website:'));
        console.log(chalk.yellow(`   ${response.url}\n`));

        // Clean up zip
        await fs.unlink(zipPath);

      } else {
        uploadSpinner.fail('Upload fehlgeschlagen');
        console.log();
        console.log(chalk.red('❌ Fehler:'), response.error);
        console.log();

        // Clean up zip
        await fs.unlink(zipPath);
        process.exit(1);
      }

    } catch (error) {
      uploadSpinner.fail('Upload fehlgeschlagen');
      console.log();
      console.log(chalk.red('❌ Fehler:'), error.message);
      console.log();

      // Clean up zip
      await fs.unlink(zipPath);
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log();
    process.exit(1);
  }
}

async function detectUploadPath() {
  const cwd = process.cwd();

  // Check for common build directories
  const buildDirs = ['dist', 'build', 'out', 'public', '.next', '_site'];

  for (const dir of buildDirs) {
    try {
      const dirPath = path.join(cwd, dir);
      await fs.access(dirPath);

      // Check if it has index.html
      const hasIndex = await checkFile(path.join(dirPath, 'index.html'));
      if (hasIndex) {
        return dirPath;
      }
    } catch (error) {
      // Directory doesn't exist, continue
    }
  }

  // Check for index.html in root
  if (await checkFile(path.join(cwd, 'index.html'))) {
    return cwd;
  }

  return null;
}

async function createZip(sourcePath, projectName) {
  const zip = new AdmZip();
  const tempDir = path.join(process.cwd(), '.kmuc-temp');
  await fs.mkdir(tempDir, { recursive: true });

  const zipPath = path.join(tempDir, `${projectName}-${Date.now()}.zip`);

  // Add directory to zip
  zip.addLocalFolder(sourcePath);

  // Write zip file
  zip.writeZip(zipPath);

  return zipPath;
}

async function uploadToServer(zipPath, projectName, token) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('project', require('fs').createReadStream(zipPath));

    const url = new URL(`/api/upload/${projectName}`, HOSTING_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid server response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    form.pipe(req);
  });
}

async function checkFile(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = { uploadCommand };
