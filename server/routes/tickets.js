const express = require('express');
const storage = require('../lib/storage');
const { scheduleBackup } = require('../lib/backup');
const { generatePrompt } = require('../lib/llm');
const { wrap } = require('../lib/async-route');
const { validateTicketInput } = require('../lib/integrity');

const router = express.Router({ mergeParams: true });

router.get('/', wrap(async (req, res) => {
  const tickets = await storage.listTickets(req.params.projectId);
  if (tickets === null) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.json(tickets);
}));

router.post('/', wrap(async (req, res) => {
  const { ok, werte, fehler } = validateTicketInput(req.body);
  if (!ok) return res.status(400).json({ error: fehler.join(' '), felder: fehler });
  const ticket = await storage.createTicket(req.params.projectId, werte);
  if (!ticket) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  scheduleBackup();
  res.status(201).json(ticket);
}));

router.get('/:ticketId', wrap(async (req, res) => {
  const ticket = await storage.getTicket(req.params.projectId, req.params.ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });
  res.json(ticket);
}));

router.put('/:ticketId', wrap(async (req, res) => {
  const { ok, werte, fehler } = validateTicketInput(req.body, { partial: true });
  if (!ok) return res.status(400).json({ error: fehler.join(' '), felder: fehler });
  const ticket = await storage.updateTicket(req.params.projectId, req.params.ticketId, werte);
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });
  scheduleBackup();
  res.json(ticket);
}));

router.delete('/:ticketId', wrap(async (req, res) => {
  const deleted = await storage.deleteTicket(req.params.projectId, req.params.ticketId);
  if (!deleted) return res.status(404).json({ error: 'Ticket nicht gefunden' });
  scheduleBackup();
  res.status(204).end();
}));

// Ausbaustufe 4: Prompt serverseitig per LLM-API generieren und im Ticket speichern.
router.post('/:ticketId/generate-prompt', wrap(async (req, res) => {
  const project = await storage.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  const ticket = await storage.getTicket(req.params.projectId, req.params.ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  try {
    const claudePrompt = await generatePrompt({ project, ticket, modelId: req.body && req.body.model });
    const updated = await storage.updateTicket(req.params.projectId, req.params.ticketId, {
      claudePrompt,
    });
    scheduleBackup();
    res.json(updated);
  } catch (err) {
    const status = err.code === 'NO_KEY' ? 501 : 502;
    res.status(status).json({ error: err.message, code: err.code || 'API_ERROR' });
  }
}));

module.exports = router;
