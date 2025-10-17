const inquirer = require('inquirer').default || require('inquirer');
const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const path = require('path');
const fs = require('fs').promises;
const { projectQuestions, vpsQuestions, cloudQuestions } = require('../prompts/questions');
const { generateDockerfile } = require('../generators/dockerfile');
const { generateDockerCompose } = require('../generators/compose');
const { generateDeployScripts } = require('../generators/deploy');
const { saveProgress, loadProgress, hasProgress, clearProgress } = require('../utils/progress');

async function initCommand(options) {
  console.log(chalk.cyan.bold('\n🚀 Willkommen bei KMUC Hoster CLI!\n'));

  // Check if we're in a safe directory
  const cwd = process.cwd();
  if (cwd === '/' || cwd === 'C:\\' || cwd === 'C:/') {
    console.error(chalk.red('❌ Nicht im Root-Verzeichnis ausführen!'));
    console.log(chalk.yellow('💡 Erstelle zuerst ein Projektverzeichnis:\n'));
    console.log(chalk.gray('   mkdir mein-projekt'));
    console.log(chalk.gray('   cd mein-projekt'));
    console.log(chalk.gray('   kmuc-hoster init\n'));
    process.exit(1);
  }

  let answers = {};
  let resumeFromStep = null;

  // Prüfe ob Fortschritt existiert
  if (await hasProgress()) {
    const savedProgress = await loadProgress();
    const resumeAnswer = await inquirer.prompt([{
      type: 'confirm',
      name: 'resume',
      message: `Möchtest du mit dem letzten Projekt "${savedProgress.answers.projectName}" fortfahren?`,
      default: true
    }]);

    if (resumeAnswer.resume) {
      answers = savedProgress.answers;
      resumeFromStep = savedProgress.currentStep;
      console.log(chalk.yellow(`\n⏩ Fahre fort ab Schritt: ${resumeFromStep}\n`));
    } else {
      await clearProgress();
      console.log(chalk.gray('Beantworte ein paar Fragen und ich erstelle dein Projekt-Setup.\n'));
    }
  } else {
    console.log(chalk.gray('Beantworte ein paar Fragen und ich erstelle dein Projekt-Setup.\n'));
  }

  try {
    // Hauptfragen stellen (nur wenn nicht resumed)
    if (!resumeFromStep) {
      answers = await inquirer.prompt(projectQuestions);

      // Port setzen (entweder custom oder default)
      if (!answers.port) {
        const defaultPorts = {
          'express': '3000',
          'nextjs': '3000',
          'react-vite': '5173',
          'node-basic': '3000',
          'static': '80'
        };
        answers.port = defaultPorts[answers.projectType] || '3000';
      }

      // needsDatabase für alte Logik setzen
      answers.needsDatabase = answers.database && answers.database !== 'none';

      const projectPath = process.cwd();
      await saveProgress(answers, 'additional-questions', projectPath);
    }

    // Zusätzliche Fragen basierend auf Deployment-Ziel
    if (resumeFromStep !== 'create-directory' && resumeFromStep !== 'dockerfile' &&
        resumeFromStep !== 'docker-compose' && resumeFromStep !== 'dockerignore' &&
        resumeFromStep !== 'deploy-scripts' && resumeFromStep !== 'env-file' && resumeFromStep !== 'readme') {

      if (answers.deploymentTarget === 'vps') {
        const vpsAnswers = await inquirer.prompt(vpsQuestions);
        Object.assign(answers, vpsAnswers);
      }

      if (answers.deploymentTarget === 'cloud') {
        const cloudAnswers = await inquirer.prompt(cloudQuestions);
        Object.assign(answers, cloudAnswers);
      }

      const projectPath = process.cwd();
      await saveProgress(answers, 'create-directory', projectPath);
    }

    // Projektverzeichnis = aktuelles Verzeichnis
    const projectPath = process.cwd();

    // Überspringe das Erstellen des Verzeichnisses, da wir direkt im aktuellen arbeiten
    if (!resumeFromStep || resumeFromStep === 'create-directory') {
      await saveProgress(answers, 'dockerfile', projectPath);
    }

    // Dockerfile generieren
    if (!resumeFromStep || resumeFromStep === 'dockerfile' || resumeFromStep === 'create-directory') {
      const spinner = ora('Generiere Dockerfile...').start();
      const dockerfile = generateDockerfile(answers);
      await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);
      spinner.succeed('Dockerfile erstellt');
      await saveProgress(answers, 'docker-compose', projectPath);
    }

    // Docker Compose generieren
    if (!resumeFromStep || ['create-directory', 'dockerfile', 'docker-compose'].includes(resumeFromStep)) {
      const spinner = ora('Generiere docker-compose.yml...').start();
      const dockerCompose = generateDockerCompose(answers);
      await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), dockerCompose);
      spinner.succeed('docker-compose.yml erstellt');
      await saveProgress(answers, 'dockerignore', projectPath);
    }

    // .dockerignore erstellen
    if (!resumeFromStep || ['create-directory', 'dockerfile', 'docker-compose', 'dockerignore'].includes(resumeFromStep)) {
      const spinner = ora('Erstelle .dockerignore...').start();
      const dockerignore = `node_modules
npm-debug.log
.env
.git
.gitignore
README.md
.DS_Store
*.log`;
      await fs.writeFile(path.join(projectPath, '.dockerignore'), dockerignore);
      spinner.succeed('.dockerignore erstellt');
      await saveProgress(answers, 'deploy-scripts', projectPath);
    }

    // Deploy Scripts generieren (NUR wenn VPS oder Cloud)
    if (answers.deploymentTarget === 'vps' || answers.deploymentTarget === 'cloud') {
      if (!resumeFromStep || ['create-directory', 'dockerfile', 'docker-compose', 'dockerignore', 'deploy-scripts'].includes(resumeFromStep)) {
        const spinner = ora('Generiere Deploy-Scripts...').start();

        // Setze needsReverseProxy und needsSSL für Script-Generierung
        answers.needsReverseProxy = !!answers.needsDomain;
        answers.needsSSL = !!answers.needsDomain;

        await generateDeployScripts(answers, projectPath);
        spinner.succeed('Deploy-Scripts erstellt');
        await saveProgress(answers, 'env-file', projectPath);
      }
    } else {
      // Überspringe deploy-scripts wenn nur lokal
      if (!resumeFromStep || resumeFromStep === 'deploy-scripts') {
        await saveProgress(answers, 'env-file', projectPath);
      }
    }

    // .env Beispieldatei erstellen
    if (!resumeFromStep || ['create-directory', 'dockerfile', 'docker-compose', 'dockerignore', 'deploy-scripts', 'env-file'].includes(resumeFromStep)) {
      const spinner = ora('Erstelle .env.example...').start();
      const envExample = generateEnvExample(answers);
      await fs.writeFile(path.join(projectPath, '.env.example'), envExample);
      spinner.succeed('.env.example erstellt');
      await saveProgress(answers, 'readme', projectPath);
    }

    // README erstellen
    if (!resumeFromStep || ['create-directory', 'dockerfile', 'docker-compose', 'dockerignore', 'deploy-scripts', 'env-file', 'readme'].includes(resumeFromStep)) {
      const spinner = ora('Erstelle README.md...').start();
      const readme = generateProjectReadme(answers);
      await fs.writeFile(path.join(projectPath, 'README.md'), readme);
      spinner.succeed('README.md erstellt');
    }

    // Fortschritt löschen nach erfolgreichem Abschluss
    await clearProgress();

    // Erfolg!
    console.log(chalk.green.bold('\n✅ Setup abgeschlossen!\n'));
    console.log(chalk.cyan('📦 Erstellte Dateien:'));
    console.log(chalk.gray('  ✓ Dockerfile'));
    console.log(chalk.gray('  ✓ docker-compose.yml'));
    console.log(chalk.gray('  ✓ .dockerignore'));
    console.log(chalk.gray('  ✓ .env.example'));
    console.log(chalk.gray('  ✓ README.md'));
    if (answers.deploymentTarget === 'vps' || answers.deploymentTarget === 'cloud') {
      console.log(chalk.gray('  ✓ scripts/deploy.sh'));
      console.log(chalk.gray('  ✓ scripts/docker-helpers.sh'));
      if (answers.needsDomain) {
        console.log(chalk.gray('  ✓ scripts/setup-domain.sh'));
        console.log(chalk.gray('  ✓ nginx.conf'));
      }
    }

    console.log();
    console.log(chalk.cyan.bold('⚡ Nächster Schritt:\n'));
    console.log(chalk.green.bold('  kmuc-hoster publish'));
    console.log(chalk.gray('  → Baut und startet automatisch alles!\n'));
    console.log(chalk.dim('  Oder manuell:'));
    console.log(chalk.dim('    1. cp .env.example .env (und anpassen)'));
    console.log(chalk.dim('    2. docker-compose up -d'));

    if (answers.deploymentTarget === 'vps' || answers.deploymentTarget === 'cloud') {
      console.log();
      console.log(chalk.cyan.bold('🚀 Deployment:\n'));
      console.log(chalk.gray('  ./scripts/deploy.sh'), chalk.dim('- Deploy auf Server'));
      if (answers.needsDomain) {
        console.log(chalk.gray('  ./scripts/setup-domain.sh'), chalk.dim('- Domain & SSL einrichten'));
      }
      console.log(chalk.gray('  ./scripts/docker-helpers.sh logs'), chalk.dim('- Logs anzeigen'));
    }

    console.log();

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log(chalk.yellow('\n💾 Fortschritt wurde gespeichert. Führe "kmuc-hoster init" erneut aus, um fortzufahren.\n'));
    process.exit(1);
  }
}

function generateEnvExample(answers) {
  let env = `# ${answers.projectName} Environment Variables\n\n`;
  env += `NODE_ENV=production\n`;
  env += `PORT=${answers.port}\n\n`;

  if (answers.needsDatabase) {
    switch (answers.database) {
      case 'postgres':
        env += `# PostgreSQL\n`;
        env += `POSTGRES_USER=user\n`;
        env += `POSTGRES_PASSWORD=changeme\n`;
        env += `POSTGRES_DB=${answers.projectName}\n`;
        env += `DATABASE_URL=postgresql://user:changeme@postgres:5432/${answers.projectName}\n`;
        break;
      case 'mongodb':
        env += `# MongoDB\n`;
        env += `MONGO_INITDB_ROOT_USERNAME=admin\n`;
        env += `MONGO_INITDB_ROOT_PASSWORD=changeme\n`;
        env += `MONGODB_URI=mongodb://admin:changeme@mongodb:27017/${answers.projectName}?authSource=admin\n`;
        break;
      case 'redis':
        env += `# Redis\n`;
        env += `REDIS_URL=redis://redis:6379\n`;
        break;
      case 'mysql':
        env += `# MySQL\n`;
        env += `MYSQL_ROOT_PASSWORD=changeme\n`;
        env += `MYSQL_DATABASE=${answers.projectName}\n`;
        env += `MYSQL_USER=user\n`;
        env += `MYSQL_PASSWORD=changeme\n`;
        env += `DATABASE_URL=mysql://user:changeme@mysql:3306/${answers.projectName}\n`;
        break;
    }
  }

  if (answers.needsDomain) {
    env += `\n# Domain\n`;
    env += `DOMAIN=${answers.domain}\n`;
  }

  return env;
}

function generateProjectReadme(answers) {
  return `# ${answers.projectName}

Generiert mit **KMUC Hoster CLI**

## Projekt-Info

- **Typ**: ${answers.projectType}
- **Port**: ${answers.port}
${answers.needsDatabase ? `- **Datenbank**: ${answers.database}` : ''}
${answers.needsDomain ? `- **Domain**: ${answers.domain}` : ''}
- **Deployment**: ${answers.deploymentTarget}

## Setup

### Lokal starten

1. Kopiere \`.env.example\` zu \`.env\` und passe die Werte an:
\`\`\`bash
cp .env.example .env
\`\`\`

2. Starte die Container:
\`\`\`bash
docker-compose up -d
\`\`\`

3. Öffne im Browser: http://localhost:${answers.port}

### Logs anzeigen

\`\`\`bash
docker-compose logs -f
\`\`\`

### Container stoppen

\`\`\`bash
docker-compose down
\`\`\`

${answers.deploymentTarget !== 'local' ? `
## Deployment

### VPS Deployment

1. Stelle sicher, dass du SSH-Zugriff hast
2. Führe das Deploy-Script aus:
\`\`\`bash
./scripts/deploy.sh
\`\`\`

${answers.needsDomain && answers.needsSSL ? `
### Domain & SSL Setup

1. Stelle sicher, dass die Domain auf deine Server-IP zeigt
2. Führe das Setup-Script aus:
\`\`\`bash
./scripts/setup-domain.sh
\`\`\`

Dieses Script installiert nginx, richtet den Reverse Proxy ein und erstellt ein SSL-Zertifikat mit Let's Encrypt.
` : ''}
` : ''}

## Lizenz

Dieses Projekt ist nur für private, nicht-kommerzielle Nutzung bestimmt.
`;
}

module.exports = { initCommand };
