// Befüllt data/projects mit dem Demo-Projekt "01_MetID Workflow Web" und
// dessen 27 Tickets aus scripts/seed-data.json.
// Aufruf: npm run seed
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA = path.join(__dirname, '..', 'data', 'projects');
const PROJECT_ID = 'metid-workflow-web-0001';

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf-8'));

const projDir = path.join(DATA, PROJECT_ID);
const ticketsDir = path.join(projDir, 'tickets');

fs.rmSync(projDir, { recursive: true, force: true });
fs.mkdirSync(ticketsDir, { recursive: true });

const base = new Date('2026-07-25T09:00:00Z');
const iso = (d) => d.toISOString().replace('.000Z', 'Z');

const project = {
  id: PROJECT_ID,
  name: '01_MetID Workflow Web',
  description:
    'Ideensammlung als Ticketsystem – 27 Tickets, kategorisiert nach Frontend/Backend/Infrastruktur/Prozess und gruppiert nach Schweregrad.',
  createdAt: iso(base),
  updatedAt: iso(base),
};
fs.writeFileSync(path.join(projDir, 'project.json'), JSON.stringify(project, null, 2), 'utf-8');

raw.forEach((t, i) => {
  const ts = iso(new Date(base.getTime() + i * 60000));
  const id = randomUUID();
  const ticket = {
    id,
    projectId: PROJECT_ID,
    titel: `${t.num} ${t.titel}`,
    beschreibung: t.beschreibung,
    kategorie: t.kategorie,
    schweregrad: t.schweregrad,
    status: t.status,
    claudePrompt: '',
    createdAt: ts,
    updatedAt: ts,
  };
  fs.writeFileSync(path.join(ticketsDir, `${id}.json`), JSON.stringify(ticket, null, 2), 'utf-8');
});

console.log(`Seed erstellt: Projekt "${project.name}" mit ${raw.length} Tickets.`);
