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

async function createProject({ name, description }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const project = { id, name, description: description || '', createdAt: now, updatedAt: now };
  await fs.mkdir(ticketsDir(id), { recursive: true });
  await writeJson(projectFile(id), project);
  return project;
}

async function updateProject(projectId, { name, description }) {
  const project = await getProject(projectId);
  if (!project) return null;
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
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
};
