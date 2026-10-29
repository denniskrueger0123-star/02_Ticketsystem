// Aufrufprotokoll der KI-Anfragen (eine JSON-Zeile pro Aufruf).
// WICHTIG: Hier werden NIE Prompt-, System- oder Antworttexte protokolliert –
// nur Metadaten (Anbieter, Modell, Zweck, Dauer, Ergebnis, Fehlertext).
const fs = require('fs');
const path = require('path');
const config = require('./config');

const FILE = path.join(config.dataDir, '..', 'llm-log.jsonl');
const PRUEF_INTERVALL = 50;

let zaehler = 0;

async function kuerzen(keep) {
  let raw;
  try {
    raw = await fs.promises.readFile(FILE, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  const zeilen = raw.split('\n').filter(Boolean);
  if (zeilen.length <= keep * 1.2) return;
  const tmp = `${FILE}.tmp`;
  await fs.promises.writeFile(tmp, zeilen.slice(-keep).join('\n') + '\n', 'utf-8');
  await fs.promises.rename(tmp, FILE);
}

async function append(eintrag) {
  const keep = config.llm.logKeep;
  if (keep === 0) return;
  try {
    const zeile = JSON.stringify({
      zeitpunkt: new Date().toISOString(),
      anbieter: eintrag.anbieter,
      anbieterLabel: eintrag.anbieterLabel,
      modell: eintrag.modell,
      zweck: eintrag.zweck,
      dauerMs: eintrag.dauerMs,
      ok: !!eintrag.ok,
      fehlerCode: eintrag.fehlerCode || null,
      fehlerText: eintrag.fehlerText || null,
    });
    await fs.promises.mkdir(path.dirname(FILE), { recursive: true });
    await fs.promises.appendFile(FILE, zeile + '\n', 'utf-8');
    zaehler++;
    if (zaehler % PRUEF_INTERVALL === 0) await kuerzen(keep);
  } catch (err) {
    console.error('[LLM-Log] Protokollieren fehlgeschlagen:', err.message);
  }
}

async function read(limit = 100) {
  let raw;
  try {
    raw = await fs.promises.readFile(FILE, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const zeile of raw.split('\n').filter(Boolean).slice(-limit)) {
    try {
      out.push(JSON.parse(zeile));
    } catch (e) {
      // beschädigte Zeile überspringen
    }
  }
  return out.reverse();
}

async function clear() {
  await fs.promises.mkdir(path.dirname(FILE), { recursive: true });
  await fs.promises.writeFile(FILE, '', 'utf-8');
}

module.exports = { append, read, clear, FILE };
