const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Muss vor dem require der Module gesetzt sein, damit nie echte Projektdaten berührt werden.
// Eigener Unterordner "projects", weil die Quarantäne neben DATA_DIR angelegt wird.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-verlauf-'));
const dataDir = path.join(tmpRoot, 'projects');
const backupDir = path.join(tmpRoot, 'projekt-backups');
process.env.DATA_DIR = dataDir;
process.env.BACKUP_DIR = backupDir;
process.env.BACKUP_INTERVAL = '0';

const storage = require('../server/lib/storage');
const { checkIntegrity, repairIntegrity } = require('../server/lib/integrity');

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const basis = { titel: 'Test', beschreibung: 'B', kategorie: 'Backend', schweregrad: 'Hoch' };
const ticketPfad = (projektId, ticketId) => path.join(dataDir, projektId, 'tickets', `${ticketId}.json`);
const lies = (pfad) => JSON.parse(fs.readFileSync(pfad, 'utf-8'));
const schreibe = (pfad, d) => fs.writeFileSync(pfad, JSON.stringify(d, null, 2), 'utf-8');

describe('Änderungsprotokoll', () => {
  test('createTicket legt den Eintrag "angelegt" an, ohne Feld quelle', async () => {
    const p = await storage.createProject({ name: 'Anlegen' });
    const t = await storage.createTicket(p.id, basis);
    assert.equal(t.verlauf.length, 1);
    assert.equal(t.verlauf[0].feld, 'angelegt');
    assert.equal(t.verlauf[0].quelle, 'manuell');
    assert.equal(t.verlauf[0].alt, null);
    assert.equal(t.verlauf[0].neu, null);
    assert.ok(!('quelle' in t));
  });

  test('updateTicket protokolliert nur echte Änderungen', async () => {
    const p = await storage.createProject({ name: 'Update' });
    const t = await storage.createTicket(p.id, basis);
    let u = await storage.updateTicket(p.id, t.id, { status: 'In Arbeit', quelle: 'inline' });
    assert.equal(u.verlauf.length, 2);
    const e = u.verlauf[1];
    assert.equal(e.feld, 'status');
    assert.equal(e.alt, 'Offen');
    assert.equal(e.neu, 'In Arbeit');
    assert.equal(e.quelle, 'inline');
    assert.ok(!('quelle' in u));

    u = await storage.updateTicket(p.id, t.id, { status: 'In Arbeit', quelle: 'inline' });
    assert.equal(u.verlauf.length, 2);

    u = await storage.updateTicket(p.id, t.id, { titel: u.titel, beschreibung: 'Neu' });
    assert.equal(u.verlauf.length, 3);
    assert.equal(u.verlauf[2].feld, 'beschreibung');
    assert.equal(u.verlauf[2].quelle, 'manuell');
  });

  test('Langer Prompt wird gekürzt abgelegt', async () => {
    const p = await storage.createProject({ name: 'Lang' });
    const t = await storage.createTicket(p.id, basis);
    const u = await storage.updateTicket(p.id, t.id, { claudePrompt: 'x'.repeat(500), quelle: 'ki' });
    const e = u.verlauf[1];
    assert.equal(e.feld, 'claudePrompt');
    assert.equal(e.neu.laenge, 500);
    assert.equal(e.neu.kurz.length, 200);
    assert.equal(e.alt, '');
  });

  test('Obergrenze 200 Einträge, "angelegt" bleibt erhalten', async () => {
    const p = await storage.createProject({ name: 'Grenze' });
    const t = await storage.createTicket(p.id, basis);
    let u = t;
    for (let i = 0; i < 205; i++) {
      u = await storage.updateTicket(p.id, t.id, { status: i % 2 === 0 ? 'In Arbeit' : 'Offen' });
    }
    assert.equal(u.verlauf.length, 200);
    assert.equal(u.verlauf[0].feld, 'angelegt');
    assert.equal(u.verlauf[199].feld, 'status');
  });

  test('Export und Import erhalten die Historie und hängen einen Import-Eintrag an', async () => {
    const p = await storage.createProject({ name: 'Export' });
    const t = await storage.createTicket(p.id, basis);
    await storage.updateTicket(p.id, t.id, { status: 'Erledigt', quelle: 'inline' });
    const exportDatei = await storage.exportProject(p.id);
    assert.equal(exportDatei.tickets[0].verlauf.length, 2);

    const r = await storage.importProject(exportDatei, { mode: 'new' });
    const [neu] = await storage.listTickets(r.project.id);
    assert.equal(neu.verlauf.length, 3);
    assert.equal(neu.verlauf[0].feld, 'angelegt');
    assert.equal(neu.verlauf[1].feld, 'status');
    assert.equal(neu.verlauf[2].feld, 'angelegt');
    assert.equal(neu.verlauf[2].quelle, 'import');
    assert.ok(!('quelle' in neu));
  });

  test('Bestandsticket ohne verlauf bekommt beim Update genau einen Eintrag', async () => {
    const p = await storage.createProject({ name: 'Bestand' });
    const t = await storage.createTicket(p.id, basis);
    const pfad = ticketPfad(p.id, t.id);
    const d = lies(pfad);
    delete d.verlauf;
    schreibe(pfad, d);

    const u = await storage.updateTicket(p.id, t.id, { status: 'Erledigt' });
    assert.equal(u.verlauf.length, 1);
    assert.equal(u.verlauf[0].feld, 'status');
  });
});

describe('Änderungsprotokoll und Integrität', () => {
  test('verlauf ohne Array ist ein Befund und wird auf [] repariert', async () => {
    const p = await storage.createProject({ name: 'Integritaet' });
    const t = await storage.createTicket(p.id, basis);
    const pfad = ticketPfad(p.id, t.id);
    const d = lies(pfad);
    d.verlauf = 'kaputt';
    schreibe(pfad, d);

    const check = await checkIntegrity();
    const befund = check.befunde.find((b) => b.code === 'VERLAUF_KAPUTT');
    assert.ok(befund);
    assert.equal(befund.reparierbar, true);

    await repairIntegrity();
    assert.deepEqual(lies(pfad).verlauf, []);
  });

  test('Fehlendes verlauf ist kein Befund', async () => {
    const p = await storage.createProject({ name: 'OhneVerlauf' });
    const t = await storage.createTicket(p.id, basis);
    const pfad = ticketPfad(p.id, t.id);
    const d = lies(pfad);
    delete d.verlauf;
    schreibe(pfad, d);

    const check = await checkIntegrity();
    assert.ok(!check.befunde.some((b) => b.code === 'VERLAUF_KAPUTT' && b.ticket && b.ticket.id === t.id));
  });

  test('Reparatur einer Schreibvariante erzeugt einen Verlaufseintrag', async () => {
    const p = await storage.createProject({ name: 'Variante' });
    const t = await storage.createTicket(p.id, basis);
    const pfad = ticketPfad(p.id, t.id);
    const d = lies(pfad);
    d.kategorie = 'backend';
    schreibe(pfad, d);

    await repairIntegrity();
    const nachher = lies(pfad);
    assert.equal(nachher.kategorie, 'Backend');
    const e = nachher.verlauf[nachher.verlauf.length - 1];
    assert.equal(e.feld, 'kategorie');
    assert.equal(e.alt, 'backend');
    assert.equal(e.neu, 'Backend');
    assert.equal(e.quelle, 'reparatur');
  });
});
