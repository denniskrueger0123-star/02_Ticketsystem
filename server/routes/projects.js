const express = require('express');
const storage = require('../lib/storage');

const router = express.Router();

router.get('/', async (req, res) => {
  const projects = await storage.listProjects();
  res.json(projects);
});

router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name ist erforderlich' });
  }
  const project = await storage.createProject({ name, description });
  res.status(201).json(project);
});

router.get('/:projectId', async (req, res) => {
  const project = await storage.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.json(project);
});

router.put('/:projectId', async (req, res) => {
  const { name, description } = req.body;
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'name darf nicht leer sein' });
  }
  const project = await storage.updateProject(req.params.projectId, { name, description });
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.json(project);
});

router.delete('/:projectId', async (req, res) => {
  const deleted = await storage.deleteProject(req.params.projectId);
  if (!deleted) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.status(204).end();
});

module.exports = router;
