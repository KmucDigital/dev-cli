const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const inquirer = require('inquirer').default || require('inquirer');
const fs = require('fs').promises;
const path = require('path');

async function ciGithubCommand(options) {
  console.log(chalk.cyan.bold('\n⚙️  GitHub Actions CI/CD Generator\n'));

  try {
    // Check if docker-compose.yml exists
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    // Detect project type
    const projectType = await detectProjectType();

    console.log(chalk.cyan('Projekt erkannt:'), chalk.yellow(projectType));
    console.log();

    // Ask configuration questions
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'trigger',
        message: 'Wann soll der Workflow ausgelöst werden?',
        choices: [
          { name: 'Bei jedem Push (alle Branches)', value: 'push' },
          { name: 'Nur bei Push zu main/master', value: 'main' },
          { name: 'Bei Pull Requests', value: 'pr' },
          { name: 'Push + Pull Requests', value: 'both' }
        ]
      },
      {
        type: 'checkbox',
        name: 'jobs',
        message: 'Welche Jobs sollen ausgeführt werden?',
        choices: [
          { name: 'Tests ausführen', value: 'test', checked: true },
          { name: 'Docker Image bauen', value: 'build', checked: true },
          { name: 'Code Linting', value: 'lint', checked: true },
          { name: 'Security Scan', value: 'security', checked: false },
          { name: 'Deploy to Production', value: 'deploy', checked: false }
        ]
      },
      {
        type: 'confirm',
        name: 'dockerHub',
        message: 'Docker Image zu Docker Hub pushen?',
        default: false,
        when: (answers) => answers.jobs.includes('build')
      },
      {
        type: 'input',
        name: 'dockerUsername',
        message: 'Docker Hub Username:',
        when: (answers) => answers.dockerHub,
        validate: input => input.length > 0 || 'Username erforderlich'
      }
    ]);

    // Generate workflow
    const workflow = generateGitHubWorkflow(projectType, answers);

    // Create .github/workflows directory
    const workflowDir = path.join(process.cwd(), '.github', 'workflows');
    await fs.mkdir(workflowDir, { recursive: true });

    const workflowPath = path.join(workflowDir, 'deploy.yml');

    const spinner = ora('Erstelle GitHub Actions Workflow...').start();

    await fs.writeFile(workflowPath, workflow);

    spinner.succeed('Workflow erstellt');

    console.log();
    console.log(chalk.green.bold('✅ GitHub Actions Workflow erstellt!\n'));
    console.log(chalk.cyan('📂 Pfad:'), chalk.yellow('.github/workflows/deploy.yml'));
    console.log();

    // Show required secrets
    if (answers.dockerHub || answers.jobs.includes('deploy')) {
      console.log(chalk.yellow.bold('🔐 Erforderliche GitHub Secrets:\n'));

      if (answers.dockerHub) {
        console.log(chalk.gray('  DOCKER_USERNAME'), chalk.dim('- Dein Docker Hub Username'));
        console.log(chalk.gray('  DOCKER_PASSWORD'), chalk.dim('- Dein Docker Hub Token/Passwort'));
        console.log();
      }

      if (answers.jobs.includes('deploy')) {
        console.log(chalk.gray('  SSH_PRIVATE_KEY'), chalk.dim('- SSH Key für Server-Zugriff'));
        console.log(chalk.gray('  SERVER_HOST'), chalk.dim('- Server IP oder Domain'));
        console.log(chalk.gray('  SERVER_USER'), chalk.dim('- SSH Username (z.B. ubuntu)'));
        console.log();
      }

      console.log(chalk.cyan('💡 Secrets hinzufügen:'));
      console.log(chalk.gray('   GitHub → Settings → Secrets → Actions → New repository secret\n'));
    }

    console.log(chalk.cyan('📋 Nächste Schritte:'));
    console.log(chalk.gray('   1. git add .github/workflows/deploy.yml'));
    console.log(chalk.gray('   2. git commit -m "Add CI/CD workflow"'));
    console.log(chalk.gray('   3. git push\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log();
    process.exit(1);
  }
}

async function ciGitlabCommand(options) {
  console.log(chalk.cyan.bold('\n⚙️  GitLab CI/CD Generator\n'));

  try {
    // Check if docker-compose.yml exists
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    // Detect project type
    const projectType = await detectProjectType();

    console.log(chalk.cyan('Projekt erkannt:'), chalk.yellow(projectType));
    console.log();

    // Ask configuration questions
    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'stages',
        message: 'Welche Stages sollen ausgeführt werden?',
        choices: [
          { name: 'Test', value: 'test', checked: true },
          { name: 'Build', value: 'build', checked: true },
          { name: 'Deploy', value: 'deploy', checked: false }
        ]
      },
      {
        type: 'confirm',
        name: 'dockerRegistry',
        message: 'Docker Image zu GitLab Registry pushen?',
        default: true,
        when: (answers) => answers.stages.includes('build')
      }
    ]);

    // Generate pipeline
    const pipeline = generateGitLabPipeline(projectType, answers);

    const pipelinePath = path.join(process.cwd(), '.gitlab-ci.yml');

    const spinner = ora('Erstelle GitLab CI Pipeline...').start();

    await fs.writeFile(pipelinePath, pipeline);

    spinner.succeed('Pipeline erstellt');

    console.log();
    console.log(chalk.green.bold('✅ GitLab CI Pipeline erstellt!\n'));
    console.log(chalk.cyan('📂 Pfad:'), chalk.yellow('.gitlab-ci.yml'));
    console.log();

    if (answers.stages.includes('deploy')) {
      console.log(chalk.yellow.bold('🔐 Erforderliche GitLab Variables:\n'));
      console.log(chalk.gray('  SSH_PRIVATE_KEY'), chalk.dim('- SSH Key für Server-Zugriff'));
      console.log(chalk.gray('  SERVER_HOST'), chalk.dim('- Server IP oder Domain'));
      console.log(chalk.gray('  SERVER_USER'), chalk.dim('- SSH Username'));
      console.log();
      console.log(chalk.cyan('💡 Variables hinzufügen:'));
      console.log(chalk.gray('   GitLab → Settings → CI/CD → Variables\n'));
    }

    console.log(chalk.cyan('📋 Nächste Schritte:'));
    console.log(chalk.gray('   1. git add .gitlab-ci.yml'));
    console.log(chalk.gray('   2. git commit -m "Add GitLab CI pipeline"'));
    console.log(chalk.gray('   3. git push\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Fehler:'), error.message);
    console.log();
    process.exit(1);
  }
}

function generateGitHubWorkflow(projectType, answers) {
  let trigger;
  switch (answers.trigger) {
    case 'push':
      trigger = 'on: [push]';
      break;
    case 'main':
      trigger = 'on:\n  push:\n    branches: [main, master]';
      break;
    case 'pr':
      trigger = 'on: [pull_request]';
      break;
    case 'both':
      trigger = 'on: [push, pull_request]';
      break;
  }

  let workflow = `name: CI/CD Pipeline

${trigger}

jobs:
`;

  // Test job
  if (answers.jobs.includes('test')) {
    workflow += `  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

`;
  }

  // Lint job
  if (answers.jobs.includes('lint')) {
    workflow += `  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint || echo "No lint script found"

`;
  }

  // Security scan
  if (answers.jobs.includes('security')) {
    workflow += `  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run security audit
        run: npm audit --audit-level=moderate

`;
  }

  // Build job
  if (answers.jobs.includes('build')) {
    workflow += `  build:
    runs-on: ubuntu-latest
${answers.jobs.includes('test') ? '    needs: [test]' : ''}
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
`;

    if (answers.dockerHub) {
      workflow += `
      - name: Log in to Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${answers.dockerUsername || 'username'}/\${{ github.event.repository.name }}:latest
`;
    } else {
      workflow += `
      - name: Build Docker image
        run: docker-compose build
`;
    }

    workflow += '\n';
  }

  // Deploy job
  if (answers.jobs.includes('deploy')) {
    workflow += `  deploy:
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: \${{ secrets.SERVER_HOST }}
          username: \${{ secrets.SERVER_USER }}
          key: \${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/your/app
            git pull origin main
            docker-compose pull
            docker-compose up -d
            docker-compose restart

`;
  }

  return workflow;
}

function generateGitLabPipeline(projectType, answers) {
  let pipeline = `# GitLab CI/CD Pipeline
# Generated by KMUC Dev CLI

stages:
${answers.stages.map(s => `  - ${s}`).join('\n')}

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

`;

  // Test stage
  if (answers.stages.includes('test')) {
    pipeline += `test:
  stage: test
  image: node:18
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npm test
  only:
    - branches

`;
  }

  // Build stage
  if (answers.stages.includes('build')) {
    pipeline += `build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker build -t $CI_REGISTRY_IMAGE:latest .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
    - master

`;
  }

  // Deploy stage
  if (answers.stages.includes('deploy')) {
    pipeline += `deploy:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - ssh-keyscan $SERVER_HOST >> ~/.ssh/known_hosts
    - chmod 644 ~/.ssh/known_hosts
  script:
    - ssh $SERVER_USER@$SERVER_HOST "
        cd /path/to/your/app &&
        git pull origin main &&
        docker-compose pull &&
        docker-compose up -d &&
        docker-compose restart"
  only:
    - main
    - master
  when: manual

`;
  }

  return pipeline;
}

async function detectProjectType() {
  try {
    // Check package.json
    const packageJson = await fs.readFile('package.json', 'utf8');
    const pkg = JSON.parse(packageJson);

    if (pkg.dependencies?.next) return 'Next.js';
    if (pkg.dependencies?.react) return 'React';
    if (pkg.dependencies?.express) return 'Express.js';
    if (pkg.dependencies?.fastify) return 'Fastify';

    return 'Node.js';
  } catch (error) {
    // Check for other markers
    if (await checkFile('requirements.txt')) return 'Python';
    if (await checkFile('go.mod')) return 'Go';
    if (await checkFile('Cargo.toml')) return 'Rust';

    return 'Docker';
  }
}

async function checkFile(filename) {
  try {
    await fs.access(path.join(process.cwd(), filename));
    return true;
  } catch {
    return false;
  }
}

module.exports = { ciGithubCommand, ciGitlabCommand };
