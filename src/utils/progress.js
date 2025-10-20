const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const PROGRESS_FILE = '.kmuc-progress.json';

/**
 * Gibt den Pfad zur Progress-Datei zurück
 */
function getProgressPath() {
  // Speichere in einem globalen Verzeichnis, damit es funktioniert
  // egal von wo aus kmuc init aufgerufen wird
  const configDir = path.join(os.homedir(), '.kmuc');
  return path.join(configDir, PROGRESS_FILE);
}

/**
 * Stellt sicher, dass das Config-Verzeichnis existiert
 */
async function ensureConfigDir() {
  const configDir = path.join(os.homedir(), '.kmuc');
  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch (error) {
    // Ignoriere Fehler
  }
}

/**
 * Speichert den aktuellen Fortschritt
 */
async function saveProgress(answers, currentStep, projectPath) {
  const progressData = {
    answers,
    currentStep,
    projectPath: projectPath || path.join(process.cwd(), answers.projectName || ''),
    timestamp: new Date().toISOString()
  };

  try {
    await ensureConfigDir();
    await fs.writeFile(
      getProgressPath(),
      JSON.stringify(progressData, null, 2)
    );
  } catch (error) {
    // Ignoriere Fehler beim Speichern
    console.error('Warnung: Fortschritt konnte nicht gespeichert werden');
  }
}

/**
 * Lädt gespeicherten Fortschritt
 */
async function loadProgress() {
  try {
    const progressPath = getProgressPath();
    const data = await fs.readFile(progressPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Kein Fortschritt gefunden
    return null;
  }
}

/**
 * Prüft ob Fortschritt existiert
 */
async function hasProgress() {
  try {
    const progressPath = getProgressPath();
    await fs.access(progressPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Löscht gespeicherten Fortschritt
 */
async function clearProgress() {
  try {
    const progressPath = getProgressPath();
    await fs.unlink(progressPath);
  } catch (error) {
    // Ignoriere Fehler
  }
}

module.exports = {
  saveProgress,
  loadProgress,
  hasProgress,
  clearProgress
};
