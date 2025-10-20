const chalk = require('chalk').default || require('chalk');
const ora = require('ora').default || require('ora');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function healthCommand(options) {
  console.log(chalk.cyan.bold('\n🏥 KMUC Health Check\n'));

  try {
    // Check if docker-compose.yml exists
    const composeExists = await checkFile('docker-compose.yml');
    if (!composeExists) {
      console.error(chalk.red('❌ Kein Docker-Projekt gefunden!'));
      console.log(chalk.yellow('💡 Führe zuerst "kmuc init" aus\n'));
      process.exit(1);
    }

    const checks = [];

    // 1. Check Docker
    const dockerCheck = await checkDocker();
    checks.push(dockerCheck);

    // 2. Check Docker Compose
    const composeCheck = await checkDockerCompose();
    checks.push(composeCheck);

    // 3. Check Configuration Files
    const configCheck = await checkConfiguration();
    checks.push(configCheck);

    // 4. Check Containers
    const containerCheck = await checkContainers();
    checks.push(containerCheck);

    // 5. Check Ports
    const portCheck = await checkPorts();
    checks.push(portCheck);

    // 6. Check Database
    const dbCheck = await checkDatabase();
    checks.push(dbCheck);

    // 7. Check Disk Space
    const diskCheck = await checkDiskSpace();
    checks.push(diskCheck);

    // Display results
    console.log();
    console.log(chalk.cyan.bold('📋 Health Check Ergebnisse:\n'));

    let allHealthy = true;
    let warnings = 0;

    for (const check of checks) {
      if (check.status === 'healthy') {
        console.log(chalk.green('✓'), chalk.white(check.name));
        console.log(chalk.gray(`  ${check.message}`));
      } else if (check.status === 'warning') {
        console.log(chalk.yellow('⚠'), chalk.white(check.name));
        console.log(chalk.yellow(`  ${check.message}`));
        warnings++;
      } else {
        console.log(chalk.red('✗'), chalk.white(check.name));
        console.log(chalk.red(`  ${check.message}`));
        allHealthy = false;
      }
      console.log();
    }

    // Summary
    console.log(chalk.cyan.bold('📊 Zusammenfassung:\n'));

    const healthyCount = checks.filter(c => c.status === 'healthy').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    const errorCount = checks.filter(c => c.status === 'error').length;

    console.log(chalk.green(`  ✓ Healthy: ${healthyCount}`));
    if (warningCount > 0) console.log(chalk.yellow(`  ⚠ Warnings: ${warningCount}`));
    if (errorCount > 0) console.log(chalk.red(`  ✗ Errors: ${errorCount}`));
    console.log();

    if (allHealthy && warnings === 0) {
      console.log(chalk.green.bold('✅ Alles gesund! System läuft optimal.\n'));
    } else if (allHealthy) {
      console.log(chalk.yellow.bold('⚠️  System läuft, aber es gibt Warnungen.\n'));
    } else {
      console.log(chalk.red.bold('❌ System hat kritische Probleme!\n'));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Health Check fehlgeschlagen:'), error.message);
    console.log();
    process.exit(1);
  }
}

async function checkDocker() {
  try {
    const { stdout } = await execAsync('docker --version');
    const version = stdout.trim();

    return {
      name: 'Docker Engine',
      status: 'healthy',
      message: version
    };
  } catch (error) {
    return {
      name: 'Docker Engine',
      status: 'error',
      message: 'Docker ist nicht installiert oder läuft nicht'
    };
  }
}

async function checkDockerCompose() {
  try {
    const { stdout } = await execAsync('docker-compose --version');
    const version = stdout.trim();

    return {
      name: 'Docker Compose',
      status: 'healthy',
      message: version
    };
  } catch (error) {
    return {
      name: 'Docker Compose',
      status: 'error',
      message: 'Docker Compose ist nicht installiert'
    };
  }
}

async function checkConfiguration() {
  const files = [];

  // Check docker-compose.yml
  if (await checkFile('docker-compose.yml')) {
    try {
      const content = await fs.readFile('docker-compose.yml', 'utf8');

      // Basic validation
      if (!content.includes('services:')) {
        return {
          name: 'Konfiguration',
          status: 'error',
          message: 'docker-compose.yml ist ungültig (keine Services definiert)'
        };
      }

      files.push('docker-compose.yml');
    } catch (error) {
      return {
        name: 'Konfiguration',
        status: 'error',
        message: 'docker-compose.yml konnte nicht gelesen werden'
      };
    }
  }

  // Check Dockerfile
  if (await checkFile('Dockerfile')) {
    files.push('Dockerfile');
  }

  // Check .env
  if (await checkFile('.env')) {
    files.push('.env');
  }

  return {
    name: 'Konfiguration',
    status: 'healthy',
    message: `Konfigurationsdateien vorhanden: ${files.join(', ')}`
  };
}

async function checkContainers() {
  try {
    const { stdout } = await execAsync('docker-compose ps --format json', {
      encoding: 'utf8'
    });

    if (!stdout.trim()) {
      return {
        name: 'Container',
        status: 'warning',
        message: 'Keine Container laufen (führe "kmuc publish" aus)'
      };
    }

    const lines = stdout.trim().split('\n');
    const containers = lines.map(line => JSON.parse(line));

    const running = containers.filter(c => c.State === 'running').length;
    const total = containers.length;

    if (running === total) {
      return {
        name: 'Container',
        status: 'healthy',
        message: `Alle ${total} Container laufen`
      };
    } else if (running > 0) {
      return {
        name: 'Container',
        status: 'warning',
        message: `${running}/${total} Container laufen`
      };
    } else {
      return {
        name: 'Container',
        status: 'error',
        message: 'Keine Container laufen'
      };
    }
  } catch (error) {
    return {
      name: 'Container',
      status: 'warning',
      message: 'Container Status konnte nicht geprüft werden'
    };
  }
}

async function checkPorts() {
  try {
    const composeContent = await fs.readFile('docker-compose.yml', 'utf8');
    const ports = extractPorts(composeContent);

    if (ports.length === 0) {
      return {
        name: 'Ports',
        status: 'healthy',
        message: 'Keine exponierten Ports definiert'
      };
    }

    // Check if ports are accessible
    const accessible = [];
    const blocked = [];

    for (const port of ports) {
      try {
        // Simple check: try to get container using this port
        const { stdout } = await execAsync(`docker ps --filter "publish=${port}" --format "{{.Names}}"`);
        if (stdout.trim()) {
          accessible.push(port);
        }
      } catch (error) {
        blocked.push(port);
      }
    }

    if (accessible.length === ports.length) {
      return {
        name: 'Ports',
        status: 'healthy',
        message: `Alle ${ports.length} Ports erreichbar: ${accessible.join(', ')}`
      };
    } else if (accessible.length > 0) {
      return {
        name: 'Ports',
        status: 'warning',
        message: `${accessible.length}/${ports.length} Ports erreichbar`
      };
    } else {
      return {
        name: 'Ports',
        status: 'warning',
        message: 'Container laufen nicht (Ports nicht gebunden)'
      };
    }
  } catch (error) {
    return {
      name: 'Ports',
      status: 'warning',
      message: 'Port-Check übersprungen'
    };
  }
}

async function checkDatabase() {
  try {
    const composeContent = await fs.readFile('docker-compose.yml', 'utf8');
    const dbInfo = detectDatabase(composeContent);

    if (!dbInfo) {
      return {
        name: 'Datenbank',
        status: 'healthy',
        message: 'Keine Datenbank konfiguriert'
      };
    }

    // Check if database container is running
    try {
      const { stdout } = await execAsync(`docker-compose ps ${dbInfo.service} --format json`);

      if (!stdout.trim()) {
        return {
          name: 'Datenbank',
          status: 'error',
          message: `${dbInfo.name} Container läuft nicht`
        };
      }

      const container = JSON.parse(stdout.trim().split('\n')[0]);

      if (container.State === 'running') {
        // Check health status if available
        if (container.Health) {
          if (container.Health === 'healthy') {
            return {
              name: 'Datenbank',
              status: 'healthy',
              message: `${dbInfo.name} läuft und ist healthy`
            };
          } else {
            return {
              name: 'Datenbank',
              status: 'warning',
              message: `${dbInfo.name} läuft, Health: ${container.Health}`
            };
          }
        } else {
          return {
            name: 'Datenbank',
            status: 'healthy',
            message: `${dbInfo.name} Container läuft`
          };
        }
      } else {
        return {
          name: 'Datenbank',
          status: 'error',
          message: `${dbInfo.name} Container Status: ${container.State}`
        };
      }
    } catch (error) {
      return {
        name: 'Datenbank',
        status: 'error',
        message: `${dbInfo.name} Status konnte nicht geprüft werden`
      };
    }
  } catch (error) {
    return {
      name: 'Datenbank',
      status: 'warning',
      message: 'Datenbank-Check übersprungen'
    };
  }
}

async function checkDiskSpace() {
  try {
    const { stdout } = await execAsync('docker system df --format "{{.Type}}|{{.Size}}"');
    const lines = stdout.trim().split('\n');

    let totalSize = 0;
    const sizes = {};

    for (const line of lines) {
      const [type, size] = line.split('|');
      sizes[type] = size;

      // Try to parse size (rough estimate)
      const match = size.match(/(\d+\.?\d*)\s*(GB|MB)/);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        totalSize += unit === 'GB' ? value : value / 1024;
      }
    }

    if (totalSize < 10) {
      return {
        name: 'Speicherplatz',
        status: 'healthy',
        message: `Docker verwendet ~${totalSize.toFixed(1)} GB`
      };
    } else if (totalSize < 50) {
      return {
        name: 'Speicherplatz',
        status: 'warning',
        message: `Docker verwendet ~${totalSize.toFixed(1)} GB (führe "kmuc clean" aus)`
      };
    } else {
      return {
        name: 'Speicherplatz',
        status: 'error',
        message: `Docker verwendet ~${totalSize.toFixed(1)} GB (kritisch! "kmuc clean --all")`
      };
    }
  } catch (error) {
    return {
      name: 'Speicherplatz',
      status: 'warning',
      message: 'Speicherplatz konnte nicht geprüft werden'
    };
  }
}

function extractPorts(composeContent) {
  const ports = [];
  const portRegex = /["']?(\d+):\d+["']?/g;
  let match;

  while ((match = portRegex.exec(composeContent)) !== null) {
    const port = match[1];
    if (!ports.includes(port)) {
      ports.push(port);
    }
  }

  return ports;
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

async function checkFile(filename) {
  try {
    await fs.access(path.join(process.cwd(), filename));
    return true;
  } catch {
    return false;
  }
}

module.exports = { healthCommand };
