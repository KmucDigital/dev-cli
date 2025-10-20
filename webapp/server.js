#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { injectVersion } = require('../src/utils/version');

const PORT = process.env.PORT || 3000;
const WEBAPP_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }

    // Inject version for HTML files
    if (ext === '.html') {
      content = injectVersion(content);
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  let filePath = path.join(WEBAPP_DIR, req.url);

  // Default to index.html
  if (filePath === WEBAPP_DIR + '/' || filePath === WEBAPP_DIR + '\\') {
    filePath = path.join(WEBAPP_DIR, 'index.html');
  }

  // If no extension, try .html
  if (!path.extname(filePath)) {
    filePath += '.html';
  }

  // Security: Prevent directory traversal
  if (!filePath.startsWith(WEBAPP_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`\n🚀 KMUC Dev CLI Website running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n📄 Available pages:`);
  console.log(`   • http://localhost:${PORT}/`);
  console.log(`   • http://localhost:${PORT}/dokumentation.html`);
  console.log(`\n⏹️  Press Ctrl+C to stop\n`);
});
