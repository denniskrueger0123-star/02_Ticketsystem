const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Muss vor dem require der Module gesetzt sein, damit nie echte Projektdaten berührt werden.
// Eigener Unterordner "projects", weil die Quarantäne neben DATA_DIR angelegt wird.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-integrity-'));
const dataDir = path.join(tmpRoot, 'projects');
const backupDir = path.join(tmpRoot, 'projekt-backups');
process.env.DATA_DIR = dataDir;
process.env.BACKUP_DIR = backupDir;
process.env.BACKUP_INTERVAL = '0';

const storage = require('../server/lib/storage');
const { validateTicketInput, checkIntegrity, repairIntegrity } = require('../server/lib/integrity');

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('validateTicketInput', () => {
  test('Pflichtfelder fehlen bei POST', () => {
    const r = validateTicketInput({});
    assert.equal(r.ok, false);
    assert.equal(r.fehler.length, 3);
  });

  test('Status fehlt -> Offen, Schreibvarianten werden normalisiert', () => {
    const r = validateTicketInput({ titel: 'X', kategorie: 'frontend', schweregrad: 'hoch', foo: 1 });
    assert.equal(r.ok, true);
    assert.deepEqual(r.werte, { titel: 'X', kategorie: 'Frontend', schweregrad: 'Hoch', status: 'Offen' });
  });

  test('Ungültiger Wert nennt Feld, Wert und erlaubte Werte', () => {
    const r = validateTicketInput({ titel: 'X', kategorie: 'Foo', schweregrad: 'Hoch' });
    assert.equal(r.ok, false);
    assert.match(r.fehler[0], /Kategorie „Foo“ ist ungültig \(erlaubt: Frontend, Backend/);
  });

  test('Leerer Titel ist ungültig', () => {
    assert.equal(validateTicketInput({ titel: '  ', kategorie: 'Backend', schweregrad: 'Hoch' }).ok, false);
  });

  test('bmStatus und Textfelder', () => {
    const r = validateTicketInput({ bmStatus: 'true', beschreibung: null, claudePrompt: 'p' }, { partial: true });
    assert.deepEqual(r.werte, { bmStatus: true, beschreibung: '', claudePrompt: 'p' });
    assert.equal(validateTicketInput({ bmStatus: 'ja' }, { partial: true }).ok, false);
    assert.equal(validateTicketInput({ beschreibung: 5 }, { partial: true }).ok, false);
  });

  test('partial prüft nur gelieferte Felder', () => {
    const r = validateTicketInput({ status: 'in arbeit' }, { partial: true });
    assert.deepEqual(r, { ok: true, werte: { status: 'In Arbeit' } });
    assert.equal(validateTicketInput({ titel: '' }, { partial: true }).ok, false);
  });
});

describe('Integritätsprüfung und Reparatur', () => {
  let projektA;
  let projektB;
  const dateien = {};
  const ticketPfad = (id) => path.join(dataDir, projektA.id, 'tickets', `${id}.json`);
  const lies = (pfad) => JSON.parse(fs.readFileSync(pfad, 'utf-8'));
  const aendere = (pfad, fn) => {
    const d = lies(pfad);
    fn(d);
    fs.writeFileSync(pfad, JSON.stringify(d, null, 2), 'utf-8');
  };
  const basis = { kategorie: 'Backend', schweregrad: 'Hoch' };

  before(async () => {
    projektA = await storage.createProject({ name: 'Projekt A' });
    projektB = await storage.createProject({ name: 'Projekt B' });

    const t1 = await storage.createTicket(projektA.id, { ...basis, titel: 'Eins' });
    const t2 = await storage.createTicket(projektA.id, { ...basis, titel: 'Zwei' });
    const kaputt = await storage.createTicket(projektA.id, { ...basis, titel: 'Kaputt' });
    const variante = await storage.createTicket(projektA.id, { ...basis, titel: 'Variante' });
    const ungueltig = await storage.createTicket(projektA.id, { ...basis, titel: 'Ungültig' });
    const bm = await storage.createTicket(projektA.id, { ...basis, titel: 'BM' });
    const dublette = await storage.createTicket(projektA.id, { ...basis, titel: '#002 Dublette' });
    const falsch = await storage.createTicket(projektA.id, { ...basis, titel: 'Falsches Projekt' });
    Object.assign(dateien, { t1, t2, kaputt, variante, ungueltig, bm, dublette, falsch });

    // Zeitstempel fest setzen, damit "jünger" nicht von der Millisekunde abhängt.
    aendere(ticketPfad(t2.id), (d) => { d.createdAt = '2020-01-01T00:00:00.000Z'; });
    aendere(ticketPfad(dublette.id), (d) => { d.createdAt = '2021-01-01T00:00:00.000Z'; });
    fs.writeFileSync(ticketPfad(kaputt.id), '{ kaputt', 'utf-8');
    aendere(ticketPfad(variante.id), (d) => { d.kategorie = 'frontend'; d.status = 'in arbeit'; });
    aendere(ticketPfad(ungueltig.id), (d) => { d.schweregrad = 'Egal'; });
    aendere(ticketPfad(bm.id), (d) => { d.bmStatus = 'true'; });
    aendere(ticketPfad(falsch.id), (d) => { d.projectId = 'falsch'; });
    fs.writeFileSync(path.join(dataDir, projektA.id, 'tickets', 'x.json.tmp'), '{', 'utf-8');
    fs.mkdirSync(path.join(dataDir, 'verwaist'));
    aendere(path.join(dataDir, projektB.id, 'project.json'), (d) => { d.id = 'anderer-name'; });
  });

  const ERWARTET_VORHER = [
    'TICKET_JSON_KAPUTT', 'WERT_VARIANTE', 'WERT_UNGUELTIG', 'BM_KEIN_BOOLEAN', 'NUMMER_DOPPELT',
    'TICKET_PROJEKT_FALSCH', 'TMP_REST', 'PROJEKT_OHNE_JSON', 'PROJEKT_ID_FALSCH',
  ];

  test('listTickets überspringt die kaputte Datei, statt zu werfen', async () => {
    const tickets = await storage.listTickets(projektA.id);
    assert.equal(tickets.length, 7);
    assert.ok(!tickets.some((t) => t.id === dateien.kaputt.id));
  });

  test('checkIntegrity liefert genau die erwarteten Codes', async () => {
    const r = await checkIntegrity();
    assert.deepEqual(new Set(r.befunde.map((b) => b.code)), new Set(ERWARTET_VORHER));
    assert.equal(r.geprueft.projekte, 3);
    assert.equal(r.geprueft.tickets, 8);
    assert.equal(r.anzahl.fehler + r.anzahl.warnungen, r.befunde.length);
    assert.equal(r.anzahl.reparierbar, r.befunde.filter((b) => b.reparierbar).length);
    assert.equal(r.anzahl.reparierbar, r.befunde.length - 2);
    assert.ok(!r.befunde.some((b) => 'aktion' in b));
    const kaputt = r.befunde.find((b) => b.code === 'TICKET_JSON_KAPUTT');
    assert.equal(kaputt.datei, `${projektA.id}/tickets/${dateien.kaputt.id}.json`);
  });

  test('repairIntegrity behebt alles Reparierbare und sichert vorher', async () => {
    const r = await repairIntegrity();
    assert.ok(r.backup.anzahlProjekte >= 1);
    const codes = new Set(r.behoben.map((b) => b.code));
    for (const code of ERWARTET_VORHER.filter((c) => c !== 'WERT_UNGUELTIG' && c !== 'PROJEKT_OHNE_JSON')) {
      assert.ok(codes.has(code), code);
    }
    assert.equal(r.uebersprungen, 2);
    assert.deepEqual(new Set(r.danach.befunde.map((b) => b.code)), new Set(['WERT_UNGUELTIG', 'PROJEKT_OHNE_JSON']));
    assert.equal(r.danach.anzahl.reparierbar, 0);
  });

  test('kaputte Datei liegt in der Quarantäne', () => {
    const dir = path.join(tmpRoot, 'quarantaene', projektA.id);
    const treffer = fs.readdirSync(dir).filter((n) => n.endsWith(`_${dateien.kaputt.id}.json`));
    assert.equal(treffer.length, 1);
    assert.ok(!fs.existsSync(ticketPfad(dateien.kaputt.id)));
  });

  test('Varianten sind normalisiert, Dublette hat neue eindeutige Nummer', async () => {
    const v = lies(ticketPfad(dateien.variante.id));
    assert.equal(v.kategorie, 'Frontend');
    assert.equal(v.status, 'In Arbeit');
    assert.equal(lies(ticketPfad(dateien.bm.id)).bmStatus, true);
    assert.equal(lies(ticketPfad(dateien.falsch.id)).projectId, projektA.id);
    assert.equal(lies(path.join(dataDir, projektB.id, 'project.json')).id, projektB.id);

    const tickets = await storage.listTickets(projektA.id);
    const nummern = tickets.map((t) => /^#(\d+)\s/.exec(t.titel)[1]);
    assert.equal(new Set(nummern).size, tickets.length);
    assert.match(lies(ticketPfad(dateien.dublette.id)).titel, /^#(?!002\s)\d{3} Dublette$/);
    assert.match(lies(ticketPfad(dateien.t2.id)).titel, /^#002 Zwei$/);
  });
});
