const express = require('express');
const storage = require('../lib/storage');
const { generatePrompt } = require('../lib/llm');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const tickets = await storage.listTickets(req.params.projectId);
  if (tickets === null) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.json(tickets);
});

router.post('/', async (req, res) => {
  const { titel } = req.body;
  if (!titel || !titel.trim()) {
    return res.status(400).json({ error: 'titel ist erforderlich' });
  }
  const ticket = await storage.createTicket(req.params.projectId, req.body);
  if (!ticket) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.status(201).json(ticket);
});

router.get('/:ticketId', async (req, res) => {
  const ticket = await storage.getTicket(req.params.projectId, req.params.ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });
  res.json(ticket);
});

router.put('/:ticketId', async (req, res) => {
  const { titel } = req.body;
  if (titel !== undefined && !titel.trim()) {
    return res.status(400).json({ error: 'titel darf nicht leer sein' });
  }
  const ticket = await storage.updateTicket(req.params.projectId, req.params.ticketId, req.body);
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });
  res.json(ticket);
});

router.delete('/:ticketId', async (req, res) => {
  const deleted = await storage.deleteTicket(req.params.projectId, req.params.ticketId);
  if (!deleted) return res.status(404).json({ error: 'Ticket nicht gefunden' });
  res.status(204).end();
});

// Ausbaustufe 4: Prompt serverseitig per LLM-API generieren und im Ticket speichern.
router.post('/:ticketId/generate-prompt', async (req, res) => {
  const project = await storage.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  const ticket = await storage.getTicket(req.params.projectId, req.params.ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  try {
    const claudePrompt = await generatePrompt({ project, ticket, modelId: req.body && req.body.model });
    const updated = await storage.updateTicket(req.params.projectId, req.params.ticketId, {
      claudePrompt,
    });
    res.json(updated);
  } catch (err) {
    const status = err.code === 'NO_KEY' ? 501 : 502;
    res.status(status).json({ error: err.message, code: err.code || 'API_ERROR' });
  }
});

module.exports = router;
