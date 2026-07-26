const express = require('express');
const storage = require('../lib/storage');
const { generateBossMovePrompt } = require('../lib/llm');

const router = express.Router();

router.get('/', async (req, res) => {
  const projects = await storage.listProjects();
  res.json(projects);
});

router.post('/', async (req, res) => {
  const { name, description, promptSkill } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name ist erforderlich' });
  }
  const project = await storage.createProject({ name, description, promptSkill });
  res.status(201).json(project);
});

// Import: legt aus einer hochgeladenen Export-Datei ein neues Projekt an.
// Muss VOR '/:projectId' stehen, sonst würde 'import' als projectId gedeutet.
router.post('/import', async (req, res) => {
  try {
    const result = await storage.importProject(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:projectId', async (req, res) => {
  const project = await storage.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.json(project);
});

// Export: ganzes Projekt inkl. aller Tickets als JSON-Datei zum Download.
router.get('/:projectId/export', async (req, res) => {
  const data = await storage.exportProject(req.params.projectId);
  if (!data) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  const safeName = (data.project.name || 'projekt')
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'projekt';
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.json"`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(data, null, 2));
});

router.put('/:projectId', async (req, res) => {
  const { name, description, promptSkill, bmPromptSkill, bmPrompt } = req.body;
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'name darf nicht leer sein' });
  }
  const project = await storage.updateProject(req.params.projectId, {
    name,
    description,
    promptSkill,
    bmPromptSkill,
    bmPrompt,
  });
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.json(project);
});

router.delete('/:projectId', async (req, res) => {
  const deleted = await storage.deleteProject(req.params.projectId);
  if (!deleted) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.status(204).end();
});

// Boss Move: aus allen grün markierten Tickets EINEN Super-Prompt generieren
// und im Projekt (Feld bmPrompt) speichern.
router.post('/:projectId/bm-prompt', async (req, res) => {
  const project = await storage.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  const tickets = (await storage.listTickets(req.params.projectId)) || [];
  const bmTickets = tickets.filter((t) => t.bmStatus === true);

  try {
    const bmPrompt = await generateBossMovePrompt({
      project,
      tickets: bmTickets,
      modelId: req.body && req.body.model,
    });
    const updated = await storage.updateProject(req.params.projectId, { bmPrompt });
    res.json({ bmPrompt: updated.bmPrompt, ticketCount: bmTickets.length });
  } catch (err) {
    const status = err.code === 'NO_KEY' ? 501 : err.code === 'NO_TICKETS' ? 400 : 502;
    res.status(status).json({ error: err.message, code: err.code || 'API_ERROR' });
  }
});

module.exports = router;
