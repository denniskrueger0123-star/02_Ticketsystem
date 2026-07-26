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

async function createProject({ name, description, promptSkill }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const project = {
    id,
    name,
    description: description || '',
    promptSkill: promptSkill || '',
    createdAt: now,
    updatedAt: now,
  };
  await fs.mkdir(ticketsDir(id), { recursive: true });
  await writeJson(projectFile(id), project);
  return project;
}

async function updateProject(projectId, { name, description, promptSkill }) {
  const project = await getProject(projectId);
  if (!project) return null;
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (promptSkill !== undefined) project.promptSkill = promptSkill;
  project.updatedAt = new Date().toISOString();
  await writeJson(projectFile(projectId), project);
  return project;
}

async function deleteProject(projectId) {
  const project = await getProject(projectId);
  if (!project) return false;
  await fs.rm(projectDir(projectId), { recursive: true, force: true });
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

async function createTicket(projectId, data) {
  const project = await getProject(projectId);
  if (!project) return null;
  const id = randomUUID();
  const now = new Date().toISOString();
  const ticket = {
    id,
    projectId,
    titel: data.titel || '',
    beschreibung: data.beschreibung || '',
    kategorie: data.kategorie || '',
    schweregrad: data.schweregrad || '',
    status: data.status || 'Offen',
    claudePrompt: data.claudePrompt || '',
    createdAt: now,
    updatedAt: now,
  };
  await writeJson(ticketFile(projectId, id), ticket);
  return ticket;
}

async function updateTicket(projectId, ticketId, data) {
  const ticket = await getTicket(projectId, ticketId);
  if (!ticket) return null;
  const fields = ['titel', 'beschreibung', 'kategorie', 'schweregrad', 'status', 'claudePrompt'];
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
    },
    tickets: tickets.map((t) => ({
      titel: t.titel || '',
      beschreibung: t.beschreibung || '',
      kategorie: t.kategorie || '',
      schweregrad: t.schweregrad || '',
      status: t.status || 'Offen',
      claudePrompt: t.claudePrompt || '',
    })),
  };
}

// Legt aus einem Export-Objekt ein NEUES Projekt an (überschreibt nie ein
// bestehendes – so kann beim Import nichts verloren gehen). Akzeptiert sowohl
// deutsche als auch englische Feldnamen, damit extern bearbeitete Dateien
// tolerant eingelesen werden.
async function importProject(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Die Datei enthält kein gültiges JSON-Objekt.');
  }
  const src = data.project && typeof data.project === 'object' ? data.project : data;
  const name = String(src.name || '').trim();
  if (!name) {
    throw new Error('Im Import fehlt der Projektname (Feld "name").');
  }
  let ticketsSrc = data.tickets;
  if (!Array.isArray(ticketsSrc)) ticketsSrc = Array.isArray(src.tickets) ? src.tickets : [];

  const project = await createProject({
    name,
    description: src.description || '',
    promptSkill: src.promptSkill || '',
  });

  let ticketCount = 0;
  for (const t of ticketsSrc) {
    if (!t || typeof t !== 'object') continue;
    await createTicket(project.id, {
      titel: t.titel || t.title || '',
      beschreibung: t.beschreibung || t.description || '',
      kategorie: t.kategorie || t.category || '',
      schweregrad: t.schweregrad || t.severity || '',
      status: t.status || 'Offen',
      claudePrompt: t.claudePrompt || t.prompt || '',
    });
    ticketCount++;
  }

  return { project, ticketCount };
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
};
