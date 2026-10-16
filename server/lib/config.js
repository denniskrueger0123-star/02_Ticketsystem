const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Bereits gesetzte Umgebungsvariablen haben Vorrang (so verhält sich loadEnvFile).
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.warn('[Config] .env konnte nicht gelesen werden:', err.message);
  }
}

function intFromEnv(name, fallback, min, max = Infinity) {
  const wert = process.env[name];
  if (wert === undefined || wert.trim() === '') return fallback;
  const zahl = Number(wert);
  if (!Number.isInteger(zahl) || zahl < min || zahl > max) {
    console.warn(`[Config] Ungültiger Wert für ${name}: "${wert}" – verwende ${fallback}.`);
    return fallback;
  }
  return zahl;
}

const backup = {
  dir: path.resolve(ROOT, process.env.BACKUP_DIR && process.env.BACKUP_DIR.trim() ? process.env.BACKUP_DIR.trim() : 'backups'),
  intervalMinutes: intFromEnv('BACKUP_INTERVAL', 60, 0, 35000), // 0 = aus; Obergrenze, weil setInterval ab 2^31 ms überläuft und dann im Millisekundentakt feuert
  keep: intFromEnv('BACKUP_KEEP', 10, 1),
};

module.exports = { ROOT, backup };
