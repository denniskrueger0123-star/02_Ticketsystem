const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Muss vor dem require von storage/project-backup gesetzt sein, damit nie echte Projektdaten berührt werden.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-data-'));
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-bak-'));
process.env.DATA_DIR = dataDir;
process.env.BACKUP_DIR = backupDir;
process.env.BACKUP_KEEP = '2';
process.env.BACKUP_INTERVAL = '0';

const storage = require('../server/lib/storage');
const { runProjectBackup, getProjectBackupStatus, scheduleBackup } = require('../server/lib/project-backup');

const pause = () => new Promise((r) => setTimeout(r, 15));

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
});

describe('Projekt-Backup', () => {
  let ergebnisse;

  before(async () => {
    for (let i = 0; i < 2; i++) {
      const p = await storage.createProject({ name: 'Gleicher Name' });
      await storage.createTicket(p.id, { titel: 'Ticket', claudePrompt: 'Prompt' });
    }
    ergebnisse = [];
    for (let i = 0; i < 3; i++) {
      ergebnisse.push(await runProjectBackup('test'));
      await pause();
    }
  });

  test('Lauf liefert keine Fehler', () => {
    for (const e of ergebnisse) assert.deepEqual(e.fehler, []);
  });

  test('pro Projekt bleiben genau KEEP Dateien mit verschiedenen Prefixen', () => {
    const dateien = fs.readdirSync(backupDir).filter((d) => d.endsWith('.json'));
    assert.equal(dateien.length, 4);
    const prefixe = new Map();
    for (const d of dateien) {
      const prefix = d.split('_')[0];
      prefixe.set(prefix, (prefixe.get(prefix) || 0) + 1);
    }
    assert.equal(prefixe.size, 2);
    for (const anzahl of prefixe.values()) assert.equal(anzahl, 2);
  });

  test('Status meldet letztes Backup ohne Fehler', async () => {
    const status = await getProjectBackupStatus();
    assert.equal(status.letztesBackup.anzahlProjekte, 2);
    assert.equal(status.letzterFehler, null);
    assert.equal(status.intervallMinuten, 0);
  });

  test('gleichzeitige Aufrufe liefern dasselbe Promise', async () => {
    const a = runProjectBackup('test');
    const b = runProjectBackup('test');
    assert.equal(a, b);
    await a;
  });

  test('scheduleBackup bündelt mehrere Änderungen zu einem Lauf pro Projekt', async () => {
    // Neue Dateien statt Gesamtzahl vergleichen, weil die Rotation (KEEP=2) alte Dateien löscht.
    const vorher = new Set(fs.readdirSync(backupDir));
    scheduleBackup();
    scheduleBackup();
    scheduleBackup();
    await new Promise((r) => setTimeout(r, 300));
    const neu = fs.readdirSync(backupDir).filter((d) => d.endsWith('.json') && !vorher.has(d));
    assert.equal(neu.length, 2);
    assert.equal(new Set(neu.map((d) => d.split('_')[0])).size, 2);
    const status = await getProjectBackupStatus();
    assert.equal(status.letztesBackup.anlass, 'Änderung');
  });

  // Zuletzt, weil der Import ein weiteres Projekt anlegt und die Zählung oben verfälschen würde.
  test('Dateiinhalt ist gültiger Export und wieder importierbar', async () => {
    const dateien = fs.readdirSync(backupDir).filter((d) => d.endsWith('.json'));
    for (const d of dateien) {
      const inhalt = JSON.parse(fs.readFileSync(path.join(backupDir, d), 'utf8'));
      assert.ok(inhalt.format);
      assert.equal(inhalt.project.name, 'Gleicher Name');
      assert.equal(inhalt.tickets.length, 1);
    }
    const inhalt = JSON.parse(fs.readFileSync(path.join(backupDir, dateien[0]), 'utf8'));
    const res = await storage.importProject(inhalt);
    assert.equal(res.ticketCount, 1);
  });
});
