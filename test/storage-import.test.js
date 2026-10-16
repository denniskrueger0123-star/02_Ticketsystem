const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Muss vor dem require von storage gesetzt sein, damit nie echte Projektdaten berührt werden.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-data-'));
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-bak-'));
process.env.DATA_DIR = dataDir;
process.env.BACKUP_DIR = backupDir;
process.env.BACKUP_KEEP = '2';
process.env.BACKUP_INTERVAL = '0';

const storage = require('../server/lib/storage');

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
});

function exportDatei(name, anzahl) {
  const tickets = [];
  for (let i = 1; i <= anzahl; i++) {
    tickets.push({
      titel: `Ticket ${i}`,
      beschreibung: `Beschreibung ${i}`,
      kategorie: 'Backend',
      schweregrad: 'Hoch',
      status: 'Offen',
      bmStatus: i === 1,
      claudePrompt: `Prompt ${i}`,
    });
  }
  return { format: 'it-ideenforum-project-export', version: 1, project: { name }, tickets };
}

const nummer = (t) => Number(/^#(\d+)/.exec(t.titel)[1]);

describe('importProject', () => {
  test('Modus new legt Projekt an, behält claudePrompt und nummeriert Titel', async () => {
    const res = await storage.importProject(exportDatei('Neu', 3), { mode: 'new' });
    assert.equal(res.ticketCount, 3);
    assert.equal(res.project.name, 'Neu');
    const tickets = await storage.listTickets(res.project.id);
    assert.equal(tickets.length, 3);
    const titel = tickets.map((t) => t.titel).sort();
    assert.deepEqual(titel, ['#001 Ticket 1', '#002 Ticket 2', '#003 Ticket 3']);
    assert.ok(tickets.every((t) => t.claudePrompt.startsWith('Prompt ')));
  });

  test('Modus append addiert Tickets, hält IDs eindeutig und setzt Nummern fort', async () => {
    const ziel = await storage.createProject({ name: 'Ziel' });
    await storage.importProject(exportDatei('x', 2), { mode: 'append', targetProjectId: ziel.id });
    const res = await storage.importProject(exportDatei('x', 3), { mode: 'append', targetProjectId: ziel.id });
    const tickets = await storage.listTickets(ziel.id);
    assert.equal(tickets.length, 5);
    assert.equal(new Set(tickets.map((t) => t.id)).size, 5);
    assert.deepEqual(tickets.map(nummer).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
    assert.ok(tickets.every((t) => t.importedAt));
    assert.ok(res.project.importedAt);
  });

  test('Modus replace meldet gelöschte Tickets und lässt nur neue übrig', async () => {
    const ziel = await storage.createProject({ name: 'Ersetzen' });
    await storage.importProject(exportDatei('x', 4), { mode: 'append', targetProjectId: ziel.id });
    const res = await storage.importProject(exportDatei('x', 2), { mode: 'replace', targetProjectId: ziel.id });
    assert.equal(res.deletedCount, 4);
    const tickets = await storage.listTickets(ziel.id);
    assert.equal(tickets.length, 2);
    assert.ok(tickets.every((t) => t.titel.startsWith('#00')));
  });

  test('ungültiger Modus wirft BAD_MODE', async () => {
    await assert.rejects(storage.importProject(exportDatei('x', 1), { mode: 'kaputt' }), { code: 'BAD_MODE' });
  });

  test('append ohne oder mit falscher targetProjectId wirft BAD_TARGET', async () => {
    await assert.rejects(storage.importProject(exportDatei('x', 1), { mode: 'append' }), { code: 'BAD_TARGET' });
    await assert.rejects(
      storage.importProject(exportDatei('x', 1), { mode: 'append', targetProjectId: 'gibt-es-nicht' }),
      { code: 'BAD_TARGET' }
    );
  });

  test('Schreibvarianten werden normalisiert, Unbekanntes landet in unbekannteWerte', async () => {
    const data = {
      project: { name: 'Varianten' },
      tickets: [
        { titel: 'A', status: 'in arbeit', kategorie: 'frontend', schweregrad: 'Hoch' },
        { titel: 'B', status: 'Erledigt', kategorie: 'Raumfahrt', schweregrad: 'Hoch' },
      ],
    };
    const res = await storage.importProject(data);
    const tickets = await storage.listTickets(res.project.id);
    const a = tickets.find((t) => t.titel.endsWith(' A'));
    assert.equal(a.status, 'In Arbeit');
    assert.equal(a.kategorie, 'Frontend');
    assert.equal(res.unbekannteWerte.length, 1);
    assert.equal(res.unbekannteWerte[0].feld, 'Kategorie');
    assert.equal(res.unbekannteWerte[0].wert, 'Raumfahrt');
    assert.equal(res.unbekannteWerte[0].ersetztDurch, 'Prozess');
  });

  test('Export und Import ergeben gleiche Ticketfelder (Roundtrip)', async () => {
    const quelle = await storage.importProject(exportDatei('Roundtrip', 3));
    const export1 = await storage.exportProject(quelle.project.id);
    const kopie = await storage.importProject(export1);
    const export2 = await storage.exportProject(kopie.project.id);
    const felder = ['titel', 'beschreibung', 'kategorie', 'schweregrad', 'status', 'bmStatus', 'claudePrompt'];
    const pick = (t) => Object.fromEntries(felder.map((f) => [f, t[f]]));
    const sortiert = (liste) => liste.map(pick).sort((a, b) => a.titel.localeCompare(b.titel));
    assert.deepEqual(sortiert(export2.tickets), sortiert(export1.tickets));
  });
});
