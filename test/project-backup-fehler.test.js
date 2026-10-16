const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// BACKUP_DIR zeigt bewusst auf eine DATEI, damit das Anlegen des Backup-Ordners scheitert.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-data-'));
const tmpBackup = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-bak-'));
const dateiAlsOrdner = path.join(tmpBackup, 'keinordner');
fs.writeFileSync(dateiAlsOrdner, 'ich bin eine Datei');
process.env.DATA_DIR = dataDir;
process.env.BACKUP_DIR = dateiAlsOrdner;
process.env.BACKUP_KEEP = '2';
process.env.BACKUP_INTERVAL = '0';

const storage = require('../server/lib/storage');
const { runProjectBackup, getProjectBackupStatus } = require('../server/lib/project-backup');

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(tmpBackup, { recursive: true, force: true });
});

test('Backup-Fehler rejecten nicht, sondern landen in fehler und Status', async () => {
  const p = await storage.createProject({ name: 'Fehlerfall' });
  await storage.createTicket(p.id, { titel: 'Ticket' });

  const ergebnis = await runProjectBackup('test');
  assert.ok(ergebnis.fehler.length >= 1);

  const status = await getProjectBackupStatus();
  assert.ok(status.letzterFehler);
  assert.equal(status.letztesBackup, null);
});
