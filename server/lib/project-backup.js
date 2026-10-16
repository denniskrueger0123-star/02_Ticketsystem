const fs = require('fs/promises');
const path = require('path');
const config = require('./config');
const storage = require('./storage');

const DATEI_MUSTER = /^(.+)_(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json$/;

const state = { lastRunAt: null, lastProjectCount: 0, lastError: null, nextRunAt: null, lastAnlass: null };
let running = null; // laufendes Promise, damit sich manueller und Intervall-Lauf nicht überlappen
let timer = null;

function slugify(name) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
  return slug || 'projekt';
}

// ID-Anteil, weil gleichnamige Projekte (z. B. nach Import) sonst dieselbe Rotation
// teilen und sich gegenseitig Backups löschen würden.
function filePrefix(project) {
  return `${slugify(project.name)}-${String(project.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
}

async function backupProject(project) {
  const data = await storage.exportProject(project.id);
  if (!data) return null;

  await fs.mkdir(config.backup.dir, { recursive: true });
  const prefix = filePrefix(project);
  const name = `${prefix}_${data.exportedAt.replace(/[:.]/g, '-')}.json`;
  const target = path.join(config.backup.dir, name);
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, target);

  const alle = await fs.readdir(config.backup.dir);
  const eigene = alle
    .filter((datei) => {
      const m = DATEI_MUSTER.exec(datei);
      return m && m[1] === prefix;
    })
    .sort();
  const zuLoeschen = eigene.slice(0, Math.max(0, eigene.length - config.backup.keep));
  for (const datei of zuLoeschen) {
    await fs.rm(path.join(config.backup.dir, datei), { force: true });
  }

  return { datei: name, tickets: data.tickets.length, geloescht: zuLoeschen.length };
}

async function doRun(anlass) {
  let anzahlProjekte = 0;
  let anzahlTickets = 0;
  let geloescht = 0;
  const fehler = [];

  let projects = [];
  try {
    projects = await storage.listProjects();
  } catch (err) {
    fehler.push({ projekt: null, meldung: err.message });
    console.error(`[Projekt-Backup] Projektliste: ${err.message}`);
  }

  for (const project of projects) {
    try {
      const ergebnis = await backupProject(project);
      if (ergebnis) {
        anzahlProjekte += 1;
        anzahlTickets += ergebnis.tickets;
        geloescht += ergebnis.geloescht;
      }
    } catch (err) {
      fehler.push({ projekt: project.name, meldung: err.message });
      console.error(`[Projekt-Backup] ${project.name}: ${err.message}`);
    }
  }

  const zeitpunkt = new Date().toISOString();
  // Ein komplett gescheiterter Lauf darf das letzte erfolgreiche Backup nicht überdecken.
  if (anzahlProjekte > 0 || fehler.length === 0) {
    state.lastRunAt = zeitpunkt;
    state.lastAnlass = anlass;
    state.lastProjectCount = anzahlProjekte;
  }
  if (fehler.length) {
    state.lastError = {
      zeitpunkt,
      meldung: fehler.map((f) => (f.projekt ? `${f.projekt}: ${f.meldung}` : f.meldung)).join('; '),
    };
  } else {
    state.lastError = null;
  }

  console.log(
    `[Projekt-Backup] ${anlass}: ${anzahlProjekte} Projekt(e), ${anzahlTickets} Ticket(s) gesichert nach ${config.backup.dir}` +
      (geloescht ? `, ${geloescht} alte Datei(en) gelöscht` : '')
  );

  return { zeitpunkt, anzahlProjekte, anzahlTickets, geloescht, fehler };
}

function runProjectBackup(anlass = 'manuell') {
  if (running) return running;
  running = doRun(anlass)
    .catch((err) => {
      const zeitpunkt = new Date().toISOString();
      state.lastError = { zeitpunkt, meldung: err.message };
      console.error(`[Projekt-Backup] Unerwarteter Fehler: ${err.message}`);
      return {
        zeitpunkt,
        anzahlProjekte: 0,
        anzahlTickets: 0,
        geloescht: 0,
        fehler: [{ projekt: null, meldung: err.message }],
      };
    })
    .finally(() => {
      running = null;
    });
  return running;
}

const MIN_INTERVAL_MS = 60_000;
let changeTimer = null;
let lastChangeRunAt = 0;

// Fire-and-forget nach Create/Update/Delete: höchstens ein Lauf pro Minute, Änderungen dazwischen werden gebündelt.
function scheduleBackup() {
  if (changeTimer) return;
  const wait = MIN_INTERVAL_MS - (Date.now() - lastChangeRunAt);
  const run = () => {
    changeTimer = null;
    lastChangeRunAt = Date.now();
    runProjectBackup('Änderung');
  };
  if (wait <= 0) {
    run();
    return;
  }
  changeTimer = setTimeout(run, wait);
  changeTimer.unref();
}

function startScheduler() {
  if (timer) return;
  const min = config.backup.intervalMinutes;
  if (min === 0) {
    console.log('[Projekt-Backup] Zeitsteuerung aus (BACKUP_INTERVAL=0).');
    state.nextRunAt = null;
    return;
  }
  const ms = min * 60_000;
  state.nextRunAt = new Date(Date.now() + ms).toISOString();
  timer = setInterval(() => {
    state.nextRunAt = new Date(Date.now() + ms).toISOString();
    lastChangeRunAt = Date.now();
    runProjectBackup('Intervall');
  }, ms);
  timer.unref();
  console.log(`[Projekt-Backup] Alle ${min} Minute(n) nach ${config.backup.dir}, je Projekt ${config.backup.keep} Backups.`);
}

async function getProjectBackupStatus() {
  let letztesBackup = null;
  if (state.lastRunAt) {
    letztesBackup = { zeitpunkt: state.lastRunAt, anzahlProjekte: state.lastProjectCount, anlass: state.lastAnlass };
  } else {
    let dateien = [];
    try {
      dateien = await fs.readdir(config.backup.dir);
    } catch (err) {
      // Nicht lesbarer Ordner (z. B. BACKUP_DIR zeigt auf eine Datei) soll den Status nicht verhindern –
      // der eigentliche Fehler steht nach dem nächsten Lauf in letzterFehler.
      if (err.code !== 'ENOENT') console.warn(`[Projekt-Backup] Backup-Ordner nicht lesbar: ${err.message}`);
    }
    const treffer = dateien.map((d) => DATEI_MUSTER.exec(d)).filter(Boolean);
    if (treffer.length) {
      const neuester = treffer.map((m) => m[2]).sort().pop();
      const prefixe = new Set(treffer.map((m) => m[1]));
      letztesBackup = {
        zeitpunkt: neuester.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z'),
        anzahlProjekte: prefixe.size,
        ausDateien: true,
      };
    }
  }

  return {
    letztesBackup,
    letzterFehler: state.lastError,
    intervallMinuten: config.backup.intervalMinutes,
    aufbewahren: config.backup.keep,
    verzeichnis: config.backup.dir,
    naechstesBackup: state.nextRunAt,
    laeuft: running !== null,
  };
}

module.exports = { runProjectBackup, startScheduler, getProjectBackupStatus, scheduleBackup };
