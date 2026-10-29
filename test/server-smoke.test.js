const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PORT = '3199';
const BASE = `http://127.0.0.1:${PORT}`;

// Eigener Unterordner "projects", damit DATA_DIR nie direkt der System-Temp-Ordner ist.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-smoke-'));
const dataDir = path.join(tmpRoot, 'projects');
const backupDir = path.join(tmpRoot, 'projekt-backups');

let child;
let exited;

function starteServer() {
  const env = { ...process.env };
  for (const key of ['HOST', 'PORT', 'BACKUP_DIR', 'BACKUP_INTERVAL', 'BACKUP_KEEP', 'DATA_DIR']) delete env[key];
  Object.assign(env, { PORT, HOST: '127.0.0.1', DATA_DIR: dataDir, BACKUP_DIR: backupDir, BACKUP_INTERVAL: '0' });
  child = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env });
  exited = new Promise((resolve) => child.once('exit', resolve));

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Server nicht rechtzeitig gestartet. stdout: ${stdout}\nstderr: ${stderr}`)), 10_000);
    child.stdout.on('data', (d) => {
      stdout += d;
      if (stdout.includes('läuft auf')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server vorzeitig beendet (Code ${code}). stderr: ${stderr}`));
    });
  });
}

before(starteServer);

after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    const killer = setTimeout(() => child.kill('SIGKILL'), 2000);
    await exited;
    clearTimeout(killer);
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Server-Rauchtest', () => {
  test('GET /api/version liefert die Version als String', async () => {
    const res = await fetch(`${BASE}/api/version`);
    assert.equal(res.status, 200);
    assert.equal(typeof (await res.json()).version, 'string');
  });

  test('Import im Modus append ohne Zielprojekt liefert 400', async () => {
    const res = await fetch(`${BASE}/api/projects/import?mode=append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(res.status, 400);
  });

  test('POST /api/backup/run liefert 200 mit fehler-Array', async () => {
    const res = await fetch(`${BASE}/api/backup/run`, { method: 'POST' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray((await res.json()).fehler));
  });

  test('POST /api/backup (Alias) liefert 200 mit fehler-Array', async () => {
    const res = await fetch(`${BASE}/api/backup`, { method: 'POST' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray((await res.json()).fehler));
  });

  test('GET /api/backup/status liefert die Projekt-Backup-Felder direkt', async () => {
    const res = await fetch(`${BASE}/api/backup/status`);
    assert.equal(res.status, 200);
    const status = await res.json();
    for (const feld of ['letztesBackup', 'letzterFehler', 'intervallMinuten', 'aufbewahren', 'verzeichnis']) {
      assert.ok(feld in status, feld);
    }
    assert.ok(!('projektBackups' in status));
  });

  describe('Ticket-Validierung und Integrität', () => {
    let projectId;
    const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    before(async () => {
      const res = await fetch(`${BASE}/api/projects`, json({ name: 'Smoke-Projekt' }));
      assert.equal(res.status, 201);
      projectId = (await res.json()).id;
    });

    test('POST Ticket mit ungültiger Kategorie liefert 400 mit felder', async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}/tickets`, json({ titel: 'X', kategorie: 'Foo', schweregrad: 'Hoch' }));
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(Array.isArray(body.felder) && body.felder.length === 1);
    });

    test('POST Ticket mit Schreibvarianten liefert 201 und normalisierte Werte', async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}/tickets`, json({ titel: 'X', kategorie: 'frontend', schweregrad: 'hoch' }));
      assert.equal(res.status, 201);
      assert.equal((await res.json()).kategorie, 'Frontend');
    });

    test('PUT mit quelle inline wird im Verlauf protokolliert, unbekannte Quelle wird manuell', async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}/tickets`, json({ titel: 'V', kategorie: 'Backend', schweregrad: 'Hoch' }));
      const ticket = await res.json();
      const put = (body) => fetch(`${BASE}/api/projects/${projectId}/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const a = await (await put({ status: 'Erledigt', quelle: 'inline' })).json();
      assert.equal(a.verlauf[a.verlauf.length - 1].quelle, 'inline');
      assert.ok(!('quelle' in a));

      const b = await (await put({ status: 'Offen', quelle: 'hacker' })).json();
      assert.equal(b.verlauf[b.verlauf.length - 1].quelle, 'manuell');
    });

    test('GET /api/integrity/check liefert 200 mit geprueft', async () => {
      const res = await fetch(`${BASE}/api/integrity/check`);
      assert.equal(res.status, 200);
      assert.ok('geprueft' in (await res.json()));
    });

    test('POST /api/integrity/repair liefert 200 mit behoben-Array', async () => {
      const res = await fetch(`${BASE}/api/integrity/repair`, { method: 'POST' });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray((await res.json()).behoben));
    });
  });
});
