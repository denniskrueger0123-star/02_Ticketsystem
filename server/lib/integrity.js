const fs = require('fs/promises');
const path = require('path');
const config = require('./config');
const { KATEGORIEN, SCHWEREGRADE, STATUS, matchValue } = require('./ticket-values');
const { runProjectBackup } = require('./project-backup');
const { appendVerlauf } = require('./storage');

// --- Validierung beim Schreiben ---

const WERTE_FELDER = [
  ['kategorie', 'Kategorie', KATEGORIEN],
  ['schweregrad', 'Schweregrad', SCHWEREGRADE],
  ['status', 'Status', STATUS],
];

function validateTicketInput(data, { partial = false } = {}) {
  const src = data && typeof data === 'object' ? data : {};
  const werte = {};
  const fehler = [];

  if (src.titel === undefined) {
    if (!partial) fehler.push('Titel ist erforderlich.');
  } else if (typeof src.titel !== 'string' || !src.titel.trim()) {
    fehler.push('Titel darf nicht leer sein.');
  } else {
    werte.titel = src.titel.trim();
  }

  for (const [feld, label, erlaubt] of WERTE_FELDER) {
    const roh = src[feld];
    if (roh === undefined) {
      if (feld === 'status') {
        if (!partial) werte.status = 'Offen';
      } else if (!partial) {
        fehler.push(`${label} ist erforderlich.`);
      }
      continue;
    }
    const treffer = matchValue(erlaubt, roh);
    if (treffer) {
      werte[feld] = treffer;
    } else {
      const anzeige = typeof roh === 'string' ? roh : JSON.stringify(roh);
      fehler.push(`${label} „${anzeige}“ ist ungültig (erlaubt: ${erlaubt.join(', ')}).`);
    }
  }

  if (src.bmStatus !== undefined) {
    if (src.bmStatus === true || src.bmStatus === 'true') werte.bmStatus = true;
    else if (src.bmStatus === false || src.bmStatus === 'false') werte.bmStatus = false;
    else fehler.push('bmStatus muss true oder false sein.');
  }

  for (const feld of ['beschreibung', 'claudePrompt']) {
    const roh = src[feld];
    if (roh === undefined) continue;
    if (roh === null) werte[feld] = '';
    else if (typeof roh === 'string') werte[feld] = roh;
    else fehler.push(`${feld} muss ein Text sein.`);
  }

  return fehler.length ? { ok: false, fehler } : { ok: true, werte };
}

// --- Prüfung und Reparatur des Datenbestands ---

const NUMMER_MUSTER = /^#(\d+)\s/;

const istLeer = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());
const istObjekt = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const rel = (...teile) => teile.join('/');

async function readJsonFile(pfad) {
  return JSON.parse(await fs.readFile(pfad, 'utf-8'));
}

async function writeJsonFile(pfad, data) {
  await fs.writeFile(pfad, JSON.stringify(data, null, 2), 'utf-8');
}

function reparaturEintrag(d, feld, alt, neu) {
  appendVerlauf(d, { zeitpunkt: new Date().toISOString(), feld, alt: alt === undefined ? null : alt, neu, quelle: 'reparatur' });
}

async function mutateJson(pfad, fn) {
  const data = await readJsonFile(pfad);
  fn(data);
  await writeJsonFile(pfad, data);
}

// Quarantäne liegt neben dataDir, damit verschobene Dateien nicht mehr als Projektdaten gelesen werden.
async function quarantaene(pfad, projektId) {
  const zielDir = path.join(config.dataDir, '..', 'quarantaene', projektId);
  await fs.mkdir(zielDir, { recursive: true });
  const stempel = new Date().toISOString().replace(/[:.]/g, '-');
  const ziel = path.join(zielDir, `${stempel}_${path.basename(pfad)}`);
  try {
    await fs.rename(pfad, ziel);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fs.copyFile(pfad, ziel);
    await fs.unlink(pfad);
  }
}

async function mtimeIso(pfad) {
  return (await fs.stat(pfad)).mtime.toISOString();
}

async function listDir(pfad) {
  try {
    return await fs.readdir(pfad, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Sammelt Befunde samt Reparaturaktion (aktion). checkIntegrity() gibt die Aktionen nicht nach außen.
async function scan() {
  const befunde = [];
  const geprueft = { projekte: 0, tickets: 0 };

  const add = (schwere, code, projekt, ticket, datei, meldung, aktion) => {
    befunde.push({ schwere, code, projekt, ticket, datei, meldung, reparierbar: Boolean(aktion), aktion });
  };

  const eintraege = (await listDir(config.dataDir)) || [];
  for (const eintrag of eintraege) {
    if (!eintrag.isDirectory()) {
      add('warnung', 'FREMDDATEI', null, null, eintrag.name, `Datei „${eintrag.name}“ liegt im Datenordner, gehört aber nicht zu einem Projekt.`);
      continue;
    }
    geprueft.projekte += 1;
    await scanProjekt(eintrag.name, geprueft, add);
  }
  return { geprueft, befunde };
}

async function scanProjekt(ordner, geprueft, add) {
  const projektDir = path.join(config.dataDir, ordner);
  const projektPfad = path.join(projektDir, 'project.json');
  const projektRel = rel(ordner, 'project.json');
  let projekt = { id: ordner, name: ordner };

  let rohProjekt;
  try {
    rohProjekt = await fs.readFile(projektPfad, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    add('fehler', 'PROJEKT_OHNE_JSON', projekt, null, ordner, `Ordner „${ordner}“ enthält keine project.json (verwaist).`);
    return;
  }

  let pdata;
  try {
    pdata = JSON.parse(rohProjekt);
    if (!istObjekt(pdata)) throw new SyntaxError('Inhalt ist kein JSON-Objekt');
  } catch (err) {
    add('fehler', 'PROJEKT_JSON_KAPUTT', projekt, null, projektRel, `project.json ist nicht lesbar: ${err.message}`,
      () => quarantaene(projektPfad, ordner));
    return;
  }

  if (typeof pdata.name === 'string' && pdata.name.trim()) projekt = { id: ordner, name: pdata.name };

  if (pdata.id !== ordner) {
    add('fehler', 'PROJEKT_ID_FALSCH', projekt, null, projektRel, `Projekt-ID „${pdata.id}“ passt nicht zum Ordnernamen „${ordner}“.`,
      () => mutateJson(projektPfad, (d) => { d.id = ordner; }));
  }
  if (typeof pdata.name !== 'string' || !pdata.name.trim()) {
    add('warnung', 'PROJEKT_NAME_LEER', projekt, null, projektRel, 'Projektname fehlt oder ist leer.',
      () => mutateJson(projektPfad, (d) => { d.name = '(unbenannt)'; }));
  }
  if (istLeer(pdata.createdAt) || istLeer(pdata.updatedAt)) {
    add('warnung', 'PROJEKT_ZEIT_FEHLT', projekt, null, projektRel, 'createdAt/updatedAt fehlt im Projekt.', async () => {
      const zeit = await mtimeIso(projektPfad);
      await mutateJson(projektPfad, (d) => {
        if (istLeer(d.createdAt)) d.createdAt = zeit;
        if (istLeer(d.updatedAt)) d.updatedAt = zeit;
      });
    });
  }

  const ticketsDir = path.join(projektDir, 'tickets');
  const dateien = await listDir(ticketsDir);
  if (dateien === null) {
    add('warnung', 'TICKETS_ORDNER_FEHLT', projekt, null, rel(ordner, 'tickets'), 'Der Ordner tickets/ fehlt.',
      () => fs.mkdir(ticketsDir, { recursive: true }));
    return;
  }

  const tickets = []; // { name, pfad, relPfad, data }
  for (const datei of dateien) {
    const relPfad = rel(ordner, 'tickets', datei.name);
    const pfad = path.join(ticketsDir, datei.name);
    if (datei.isFile() && datei.name.endsWith('.tmp')) {
      add('warnung', 'TMP_REST', projekt, null, relPfad, `Übrig gebliebene Temp-Datei „${datei.name}“.`, () => fs.rm(pfad, { force: true }));
      continue;
    }
    if (!datei.isFile() || !datei.name.endsWith('.json')) {
      add('warnung', 'FREMDDATEI', projekt, null, relPfad, `„${datei.name}“ ist keine Ticket-Datei.`);
      continue;
    }
    geprueft.tickets += 1;
    const id = datei.name.slice(0, -'.json'.length);
    try {
      const data = JSON.parse(await fs.readFile(pfad, 'utf-8'));
      if (!istObjekt(data)) throw new SyntaxError('Inhalt ist kein JSON-Objekt');
      tickets.push({ id, pfad, relPfad, data });
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      add('fehler', 'TICKET_JSON_KAPUTT', projekt, { id, titel: '' }, relPfad, `Ticket-Datei ist nicht lesbar: ${err.message}`,
        () => quarantaene(pfad, ordner));
    }
  }

  // Deterministische Reihenfolge: ältestes Ticket behält bei Dubletten seine Nummer.
  tickets.sort((a, b) => {
    const ka = typeof a.data.createdAt === 'string' ? a.data.createdAt : '';
    const kb = typeof b.data.createdAt === 'string' ? b.data.createdAt : '';
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Wie nextTicketNummer in storage.js: höchste belegte Nummer + 1; hier fortlaufend, damit
  // mehrere Reparaturen im selben Lauf keine neue Dublette erzeugen.
  let maxNummer = 0;
  for (const t of tickets) {
    const m = typeof t.data.titel === 'string' ? NUMMER_MUSTER.exec(t.data.titel) : null;
    if (m) maxNummer = Math.max(maxNummer, parseInt(m[1], 10));
  }
  const neueNummer = () => {
    maxNummer += 1;
    return String(maxNummer).padStart(3, '0');
  };
  const vergebeNummer = (pfad, nummer) => mutateJson(pfad, (d) => {
    const titel = String(d.titel || '');
    d.titel = NUMMER_MUSTER.test(titel) ? titel.replace(/^#\d+\s+/, `#${nummer} `) : `#${nummer} ${titel}`;
    reparaturEintrag(d, 'titel', titel, d.titel);
  });

  const vergeben = new Set();
  for (const t of tickets) {
    const { id, pfad, relPfad, data } = t;
    const ticket = { id, titel: typeof data.titel === 'string' ? data.titel : '' };
    const melde = (schwere, code, meldung, aktion) => add(schwere, code, projekt, ticket, relPfad, meldung, aktion);

    if (data.id !== id) {
      melde('fehler', 'TICKET_ID_FALSCH', `Ticket-ID „${data.id}“ passt nicht zum Dateinamen „${id}“.`,
        () => mutateJson(pfad, (d) => { d.id = id; }));
    }
    if (data.projectId !== ordner) {
      melde('fehler', 'TICKET_PROJEKT_FALSCH', `projectId „${data.projectId}“ passt nicht zum Projektordner „${ordner}“.`,
        () => mutateJson(pfad, (d) => { d.projectId = ordner; }));
    }

    for (const [feld, label, erlaubt] of WERTE_FELDER) {
      const wert = data[feld];
      if (typeof wert === 'string' && erlaubt.includes(wert)) continue;
      const variante = matchValue(erlaubt, wert);
      if (variante) {
        melde('warnung', 'WERT_VARIANTE', `${label} „${wert}“ ist eine Schreibvariante von „${variante}“.`,
          () => mutateJson(pfad, (d) => {
            reparaturEintrag(d, feld, d[feld], variante);
            d[feld] = variante;
          }));
      } else if (istLeer(wert)) {
        if (feld === 'status') {
          melde('fehler', 'WERT_LEER', 'Status ist leer.', () => mutateJson(pfad, (d) => {
            reparaturEintrag(d, 'status', d.status, 'Offen');
            d.status = 'Offen';
          }));
        } else {
          melde('fehler', 'WERT_LEER', `${label} ist leer.`);
        }
      } else {
        melde('fehler', 'WERT_UNGUELTIG', `${label} „${typeof wert === 'string' ? wert : JSON.stringify(wert)}“ ist ungültig (erlaubt: ${erlaubt.join(', ')}).`);
      }
    }

    // Fehlendes bmStatus ist normal (Seed und Bestandsdaten vor dem BM-Feld) und gilt überall als false.
    if (data.bmStatus !== undefined && typeof data.bmStatus !== 'boolean') {
      melde('warnung', 'BM_KEIN_BOOLEAN', `bmStatus ist kein boolean (${JSON.stringify(data.bmStatus)}).`,
        () => mutateJson(pfad, (d) => {
          const neu = d.bmStatus === true || d.bmStatus === 'true';
          reparaturEintrag(d, 'bmStatus', d.bmStatus, neu);
          d.bmStatus = neu;
        }));
    }

    // Fehlendes verlauf ist normal (Bestandsdaten vor dem Änderungsprotokoll).
    if (data.verlauf !== undefined && !Array.isArray(data.verlauf)) {
      melde('warnung', 'VERLAUF_KAPUTT', 'verlauf ist kein Array.', () => mutateJson(pfad, (d) => { d.verlauf = []; }));
    }

    if (typeof data.titel !== 'string' || !data.titel.trim()) {
      melde('fehler', 'TITEL_LEER', 'Titel fehlt oder ist leer.');
    } else {
      const m = NUMMER_MUSTER.exec(data.titel);
      if (!m) {
        const nummer = neueNummer();
        melde('warnung', 'TITEL_OHNE_NUMMER', `Titel hat keine Nummer (#NNN); vergebe #${nummer}.`, () => vergebeNummer(pfad, nummer));
      } else {
        const nr = parseInt(m[1], 10);
        if (vergeben.has(nr)) {
          const nummer = neueNummer();
          melde('warnung', 'NUMMER_DOPPELT', `Nummer #${m[1]} ist doppelt vergeben; vergebe #${nummer}.`, () => vergebeNummer(pfad, nummer));
        } else {
          vergeben.add(nr);
        }
      }
    }

    if (istLeer(data.createdAt) || istLeer(data.updatedAt)) {
      melde('warnung', 'TICKET_ZEIT_FEHLT', 'createdAt/updatedAt fehlt im Ticket.', async () => {
        const zeit = await mtimeIso(pfad);
        await mutateJson(pfad, (d) => {
          if (istLeer(d.createdAt)) d.createdAt = zeit;
          if (istLeer(d.updatedAt)) d.updatedAt = zeit;
        });
      });
    }
  }
}

function zusammenfassung(befunde) {
  return {
    fehler: befunde.filter((b) => b.schwere === 'fehler').length,
    warnungen: befunde.filter((b) => b.schwere === 'warnung').length,
    reparierbar: befunde.filter((b) => b.reparierbar).length,
  };
}

function oeffentlich({ aktion, ...rest }) {
  return rest;
}

async function checkIntegrity() {
  const { geprueft, befunde } = await scan();
  return {
    zeitpunkt: new Date().toISOString(),
    geprueft,
    befunde: befunde.map(oeffentlich),
    anzahl: zusammenfassung(befunde),
  };
}

async function repairIntegrity() {
  const zeitpunkt = new Date().toISOString();
  const backup = await runProjectBackup('vor Reparatur');
  const { befunde } = await scan();

  const behoben = [];
  const fehlgeschlagen = [];
  let uebersprungen = 0;
  for (const b of befunde) {
    if (!b.aktion) {
      uebersprungen += 1;
      continue;
    }
    try {
      await b.aktion();
      behoben.push({ code: b.code, datei: b.datei, meldung: b.meldung });
    } catch (err) {
      console.error(`[Integrität] Reparatur von ${b.datei} (${b.code}) fehlgeschlagen: ${err.message}`);
      fehlgeschlagen.push({ code: b.code, datei: b.datei, meldung: err.message });
    }
  }
  console.log(`[Integrität] Reparatur: ${behoben.length} behoben, ${uebersprungen} nicht reparierbar, ${fehlgeschlagen.length} fehlgeschlagen`);

  return { zeitpunkt, backup, behoben, fehlgeschlagen, uebersprungen, danach: await checkIntegrity() };
}

module.exports = { validateTicketInput, checkIntegrity, repairIntegrity };
