const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'projects');

function projectDir(projectId) {
  return path.join(DATA_DIR, projectId);
}

function projectFile(projectId) {
  return path.join(projectDir(projectId), 'project.json');
}

function ticketsDir(projectId) {
  return path.join(projectDir(projectId), 'tickets');
}

function ticketFile(projectId, ticketId) {
  return path.join(ticketsDir(projectId), `${ticketId}.json`);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// --- Projekte ---

async function listProjects() {
  await ensureDataDir();
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const project = await readJson(projectFile(entry.name));
      projects.push(project);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return projects;
}

async function getProject(projectId) {
  try {
    return await readJson(projectFile(projectId));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function createProject({ name, description, promptSkill, bmPromptSkill, bmPrompt, projektReadme, importedAt }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const project = {
    id,
    name,
    description: description || '',
    promptSkill: promptSkill || '',
    bmPromptSkill: bmPromptSkill || '',
    bmPrompt: bmPrompt || '',
    projektReadme: projektReadme || '',
    importedAt: importedAt || null,
    lastExportedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await fs.mkdir(ticketsDir(id), { recursive: true });
  await writeJson(projectFile(id), project);
  return project;
}

async function updateProject(projectId, { name, description, promptSkill, bmPromptSkill, bmPrompt, projektReadme, lastExportedAt, importedAt }) {
  const project = await getProject(projectId);
  if (!project) return null;
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (promptSkill !== undefined) project.promptSkill = promptSkill;
  if (bmPromptSkill !== undefined) project.bmPromptSkill = bmPromptSkill;
  if (bmPrompt !== undefined) project.bmPrompt = bmPrompt;
  if (projektReadme !== undefined) project.projektReadme = projektReadme;
  if (lastExportedAt !== undefined) project.lastExportedAt = lastExportedAt;
  if (importedAt !== undefined) project.importedAt = importedAt;
  project.updatedAt = new Date().toISOString();
  await writeJson(projectFile(projectId), project);
  return project;
}

async function deleteProject(projectId) {
  const project = await getProject(projectId);
  if (!project) return false;
  // maxRetries/retryDelay: unter Windows sperren OneDrive-Sync und Virenscanner
  // Dateien kurzzeitig (EPERM/EBUSY), wodurch das Löschen sonst hart scheitert.
  await fs.rm(projectDir(projectId), { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  return true;
}

// --- Tickets ---

async function listTickets(projectId) {
  const dir = ticketsDir(projectId);
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const tickets = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    tickets.push(await readJson(path.join(dir, entry)));
  }
  tickets.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return tickets;
}

async function getTicket(projectId, ticketId) {
  try {
    return await readJson(ticketFile(projectId, ticketId));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function nextTicketNummer(projectId) {
  const tickets = (await listTickets(projectId)) || [];
  let max = 0;
  for (const t of tickets) {
    const m = String(t.titel || '').match(/^#(\d+)\s/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

async function createTicket(projectId, data) {
  const project = await getProject(projectId);
  if (!project) return null;
  const id = randomUUID();
  const now = new Date().toISOString();
  let titel = data.titel || '';
  if (!/^#\d+\s/.test(titel)) {
    const nummer = await nextTicketNummer(projectId);
    titel = titel ? `#${nummer} ${titel}` : `#${nummer}`;
  }
  const ticket = {
    id,
    projectId,
    titel,
    beschreibung: data.beschreibung || '',
    kategorie: data.kategorie || '',
    schweregrad: data.schweregrad || '',
    status: data.status || 'Offen',
    bmStatus: data.bmStatus === true,
    claudePrompt: data.claudePrompt || '',
    importedAt: data.importedAt || null,
    createdAt: now,
    updatedAt: now,
  };
  await writeJson(ticketFile(projectId, id), ticket);
  return ticket;
}

async function updateTicket(projectId, ticketId, data) {
  const ticket = await getTicket(projectId, ticketId);
  if (!ticket) return null;
  const fields = ['titel', 'beschreibung', 'kategorie', 'schweregrad', 'status', 'bmStatus', 'claudePrompt'];
  for (const field of fields) {
    if (data[field] !== undefined) ticket[field] = data[field];
  }
  ticket.updatedAt = new Date().toISOString();
  await writeJson(ticketFile(projectId, ticketId), ticket);
  return ticket;
}

async function deleteTicket(projectId, ticketId) {
  const ticket = await getTicket(projectId, ticketId);
  if (!ticket) return false;
  await fs.rm(ticketFile(projectId, ticketId), { force: true });
  return true;
}

// --- Export / Import (ganzes Projekt inkl. Tickets als eine JSON-Datei) ---

const EXPORT_FORMAT = 'it-ideenforum-project-export';
const EXPORT_VERSION = 1;

// Erzeugt ein aufgeräumtes, extern editierbares JSON-Objekt. Interne IDs und
// Zeitstempel werden bewusst weggelassen – die Datei soll leicht von einer
// anderen KI gelesen und verändert werden können; beim Import werden IDs neu
// vergeben.
async function exportProject(projectId) {
  const project = await getProject(projectId);
  if (!project) return null;
  const tickets = (await listTickets(projectId)) || [];
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      description: project.description || '',
      promptSkill: project.promptSkill || '',
      bmPromptSkill: project.bmPromptSkill || '',
      bmPrompt: project.bmPrompt || '',
      projektReadme: project.projektReadme || '',
    },
    tickets: tickets.map((t) => ({
      titel: t.titel || '',
      beschreibung: t.beschreibung || '',
      kategorie: t.kategorie || '',
      schweregrad: t.schweregrad || '',
      status: t.status || 'Offen',
      bmStatus: t.bmStatus === true,
      claudePrompt: t.claudePrompt || '',
    })),
  };
}

// Importiert ein Export-Objekt. Modus "new" legt ein NEUES Projekt an, "append"
// hängt die Tickets an ein bestehendes Projekt an, "replace" löscht dessen
// Tickets vorher. Akzeptiert sowohl deutsche als auch englische Feldnamen,
// damit extern bearbeitete Dateien tolerant eingelesen werden.
async function importProject(data, { mode = 'new', targetProjectId } = {}) {
  if (!['new', 'append', 'replace'].includes(mode)) {
    const err = new Error('Ungültiger Import-Modus.');
    err.code = 'BAD_MODE';
    throw err;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Die Datei enthält kein gültiges JSON-Objekt.');
  }
  const src = data.project && typeof data.project === 'object' ? data.project : data;
  let ticketsSrc = data.tickets;
  if (!Array.isArray(ticketsSrc)) ticketsSrc = Array.isArray(src.tickets) ? src.tickets : [];

  const now = new Date().toISOString();
  let project;
  let deletedCount = 0;

  if (mode === 'new') {
    const name = String(src.name || '').trim();
    if (!name) {
      throw new Error('Im Import fehlt der Projektname (Feld "name").');
    }
    project = await createProject({
      name,
      description: src.description || '',
      promptSkill: src.promptSkill || '',
      bmPromptSkill: src.bmPromptSkill || '',
      bmPrompt: src.bmPrompt || '',
      projektReadme: src.projektReadme || '',
      importedAt: now,
    });
  } else {
    project = targetProjectId ? await getProject(targetProjectId) : null;
    if (!project) {
      const err = new Error('Zielprojekt nicht gefunden.');
      err.code = 'BAD_TARGET';
      throw err;
    }
    if (mode === 'replace') {
      const existing = (await listTickets(project.id)) || [];
      for (const t of existing) {
        if (await deleteTicket(project.id, t.id)) deletedCount++;
      }
    }
  }

  let ticketCount = 0;
  for (const t of ticketsSrc) {
    if (!t || typeof t !== 'object') continue;
    let titel = t.titel || t.title || '';
    // Alte Nummer entfernen, damit createTicket fortlaufend neu nummeriert
    // (sonst gäbe es beim Anhängen doppelte Nummern).
    if (mode !== 'new') titel = String(titel).replace(/^#\d+\s+/, '');
    await createTicket(project.id, {
      titel,
      beschreibung: t.beschreibung || t.description || '',
      kategorie: t.kategorie || t.category || '',
      schweregrad: t.schweregrad || t.severity || '',
      status: t.status || 'Offen',
      bmStatus: t.bmStatus === true,
      claudePrompt: t.claudePrompt || t.prompt || '',
      importedAt: now,
    });
    ticketCount++;
  }

  if (mode !== 'new') project = await updateProject(project.id, { importedAt: now });

  return { project, ticketCount, mode, deletedCount };
}

// --- Export / Import (ALLE Projekte in einer JSON-Datei) ---

const MULTI_EXPORT_FORMAT = 'it-ideenforum-multi-export';
const MULTI_EXPORT_VERSION = 1;

async function exportAllProjects() {
  const projects = await listProjects();
  const entries = [];
  for (const p of projects) {
    const data = await exportProject(p.id);
    if (data) entries.push({ project: data.project, tickets: data.tickets });
  }
  return {
    format: MULTI_EXPORT_FORMAT,
    version: MULTI_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    projectCount: entries.length,
    projects: entries,
  };
}

// Importiert mehrere Projekte aus einer Gesamt-Export-Datei. Jeder Eintrag
// wird einzeln über importProject() angelegt; ein fehlerhafter Eintrag
// bricht den restlichen Import nicht ab, sondern landet in "failed".
async function importAllProjects(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Die Datei enthält kein gültiges JSON-Objekt.');
  }
  const list = Array.isArray(data.projects) ? data.projects : null;
  if (!list) {
    throw new Error('Im Import fehlt die Liste "projects".');
  }
  const imported = [];
  const failed = [];
  for (const entry of list) {
    const name = (entry && entry.project && entry.project.name) || (entry && entry.name) || '(unbenannt)';
    try {
      const result = await importProject(entry);
      imported.push({ name: result.project.name, ticketCount: result.ticketCount });
    } catch (err) {
      failed.push({ name, error: err.message });
    }
  }
  return { imported, failed };
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  exportProject,
  importProject,
  exportAllProjects,
  importAllProjects,
};
