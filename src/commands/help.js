const chalk = require('chalk').default || require('chalk');
const path = require('path');
const http = require('http');
const fs = require('fs').promises;
const { exec } = require('child_process');

async function helpCommand() {
  console.log(chalk.cyan.bold('\n📖 KMUC Hoster CLI Hilfe\n'));
  console.log(chalk.gray('Starte lokalen Server für die Dokumentation...\n'));

  const htmlPath = path.join(__dirname, '../templates/help.html');

  try {
    // Lese HTML Datei
    const html = await fs.readFile(htmlPath, 'utf8');

    // Erstelle HTTP Server
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    // Starte Server auf zufälligem Port
    server.listen(0, 'localhost', () => {
      const port = server.address().port;
      const url = `http://localhost:${port}`;

      console.log(chalk.green('✅ Dokumentation geöffnet!\n'));
      console.log(chalk.cyan('🌐 URL:'), chalk.yellow(url));
      console.log();
      console.log(chalk.gray('Drücke Ctrl+C um den Server zu stoppen\n'));

      // Öffne im Browser
      const command = process.platform === 'win32' ? 'start' :
                      process.platform === 'darwin' ? 'open' : 'xdg-open';

      exec(`${command} ${url}`, (error) => {
        if (error) {
          console.log(chalk.yellow('⚠️  Konnte Browser nicht automatisch öffnen'));
          console.log(chalk.gray(`   Öffne manuell: ${url}\n`));
        }
      });
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.cyan('\n\n👋 Server wird gestoppt...'));
      server.close(() => {
        console.log(chalk.green('✅ Server gestoppt\n'));
        process.exit(0);
      });
    });

  } catch (error) {
    console.error(chalk.red('❌ Fehler beim Laden der Hilfe-Datei:'), error.message);
    console.log();
    console.log(chalk.cyan.bold('Schnellhilfe:\n'));
    console.log(chalk.yellow('📦 Verfügbare Befehle:\n'));
    console.log(chalk.gray('  kmuc init'), chalk.dim('- Projekt initialisieren'));
    console.log(chalk.gray('  kmuc publish'), chalk.dim('- Container bauen & starten'));
    console.log(chalk.gray('  kmuc deploy'), chalk.dim('- Auf Server deployen'));
    console.log(chalk.gray('  kmuc help'), chalk.dim('- Diese Hilfe anzeigen'));
    console.log();
    process.exit(1);
  }
}

module.exports = { helpCommand };
