const { createBackup, pruneBackups } = require('./storage');

const MIN_INTERVAL_MS = 60_000;
const KEEP = 10;

let lastRunAt = 0;
let timer = null;
let running = false;

// Wirft bei Fehlern – für den manuellen Aufruf, der dem Nutzer den Fehler zeigen soll.
async function runBackup() {
  const backup = await createBackup();
  const { geloescht } = await pruneBackups(KEEP);
  return { ...backup, geloescht };
}

async function autoRun() {
  timer = null;
  if (running) return;
  running = true;
  // Auch bei Fehler setzen, damit ein dauerhaft kaputtes Ziel keine Retry-Flut auslöst.
  lastRunAt = Date.now();
  try {
    await runBackup();
  } catch (err) {
    console.error('[Backup] Automatisches Backup fehlgeschlagen:', err.message);
  } finally {
    running = false;
  }
}

// Fire-and-forget: höchstens ein Lauf pro Minute, Änderungen dazwischen werden gebündelt.
function scheduleBackup() {
  if (timer) return;
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRunAt);
  if (wait <= 0) {
    autoRun();
    return;
  }
  timer = setTimeout(autoRun, wait);
  timer.unref();
}

module.exports = { runBackup, scheduleBackup };
