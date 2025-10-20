const fs = require('fs');
const path = require('path');

/**
 * Lädt die Version aus package.json
 * @returns {string} Die aktuelle Version
 */
function getVersion() {
  try {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error('Fehler beim Laden der Version:', error.message);
    return '0.0.0';
  }
}

/**
 * Ersetzt alle Versionsnummern in einem HTML String
 * @param {string} html - Der HTML String
 * @returns {string} HTML mit ersetzten Versionsnummern
 */
function injectVersion(html) {
  const version = getVersion();

  // Ersetze alle Muster:
  // v2.x.x -> vX.Y.Z
  // Version 2.x.x -> Version X.Y.Z
  // version: 2.x.x -> version: X.Y.Z
  return html
    .replace(/v\d+\.\d+\.\d+/g, `v${version}`)
    .replace(/Version\s+\d+\.\d+\.\d+/gi, `Version ${version}`)
    .replace(/version:\s*\d+\.\d+\.\d+/gi, `version: ${version}`)
    .replace(/version\s*=\s*["']\d+\.\d+\.\d+["']/gi, `version="${version}"`);
}

module.exports = {
  getVersion,
  injectVersion
};
