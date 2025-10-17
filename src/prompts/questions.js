const projectQuestions = [
  {
    type: 'input',
    name: 'projectName',
    message: '📝 Projektname:',
    default: 'my-app',
    validate: (input) => {
      if (/^[a-z0-9-]+$/.test(input)) return true;
      return 'Projektname darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten';
    }
  },
  {
    type: 'list',
    name: 'projectType',
    message: '🔧 Welche Art von Projekt?',
    choices: [
      { name: 'Node.js Express API', value: 'express' },
      { name: 'Next.js (React)', value: 'nextjs' },
      { name: 'React SPA (Vite)', value: 'react-vite' },
      { name: 'Node.js Basis', value: 'node-basic' },
      { name: 'Static Website (nginx)', value: 'static' }
    ]
  },
  {
    type: 'confirm',
    name: 'useDefaultPort',
    message: (answers) => {
      const defaultPorts = {
        'express': '3000',
        'nextjs': '3000',
        'react-vite': '5173',
        'node-basic': '3000',
        'static': '80'
      };
      return `🔌 Standard Port ${defaultPorts[answers.projectType]} verwenden?`;
    },
    default: true
  },
  {
    type: 'input',
    name: 'port',
    message: '🔌 Welcher Port?',
    when: (answers) => !answers.useDefaultPort,
    default: (answers) => {
      const defaultPorts = {
        'express': '3000',
        'nextjs': '3000',
        'react-vite': '5173',
        'node-basic': '3000',
        'static': '80'
      };
      return defaultPorts[answers.projectType] || '3000';
    },
    validate: (input) => {
      const port = parseInt(input);
      if (port > 0 && port < 65536) return true;
      return 'Port muss zwischen 1 und 65535 liegen';
    },
    filter: (input) => input.toString()
  },
  {
    type: 'list',
    name: 'database',
    message: '💾 Datenbank?',
    choices: [
      { name: 'Keine Datenbank', value: 'none' },
      { name: 'PostgreSQL', value: 'postgres' },
      { name: 'MongoDB', value: 'mongodb' },
      { name: 'Redis (Cache)', value: 'redis' },
      { name: 'MySQL', value: 'mysql' }
    ],
    default: 'none'
  },
  {
    type: 'list',
    name: 'deploymentTarget',
    message: '🚀 Deployment-Ziel?',
    choices: [
      { name: 'Nur lokal entwickeln', value: 'local' },
      { name: 'VPS/Server (eigener Server)', value: 'vps' },
      { name: 'Cloud (DigitalOcean, Hetzner, etc.)', value: 'cloud' }
    ],
    default: 'local'
  },
  {
    type: 'confirm',
    name: 'needsDomain',
    message: '🌐 Domain & SSL Setup benötigt?',
    default: false,
    when: (answers) => answers.deploymentTarget !== 'local'
  },
  {
    type: 'input',
    name: 'domain',
    message: '🌐 Domain (z.B. example.com):',
    when: (answers) => answers.needsDomain,
    validate: (input) => {
      if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(input)) return true;
      return 'Bitte gib eine gültige Domain ein';
    }
  }
];

const vpsQuestions = [
  {
    type: 'input',
    name: 'serverIP',
    message: 'Server IP-Adresse:',
    validate: (input) => {
      if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(input)) return true;
      return 'Bitte gib eine gültige IP-Adresse ein';
    }
  },
  {
    type: 'input',
    name: 'serverUser',
    message: 'SSH Benutzername:',
    default: 'root'
  },
  {
    type: 'input',
    name: 'serverPort',
    message: 'SSH Port:',
    default: '22'
  }
];

const cloudQuestions = [
  {
    type: 'list',
    name: 'cloudProvider',
    message: 'Welchen Cloud Provider möchtest du verwenden?',
    choices: [
      { name: 'DigitalOcean', value: 'digitalocean' },
      { name: 'Hetzner Cloud', value: 'hetzner' },
      { name: 'AWS EC2', value: 'aws' },
      { name: 'Generisch (eigenes Setup)', value: 'generic' }
    ]
  }
];

module.exports = { projectQuestions, vpsQuestions, cloudQuestions };
