const express = require('express');
const llmLog = require('../lib/llm-log');

const router = express.Router();

router.get('/log', async (req, res) => {
  try {
    const roh = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(roh) ? Math.min(500, Math.max(1, roh)) : 100;
    res.json({ eintraege: await llmLog.read(limit), datei: llmLog.FILE });
  } catch (err) {
    res.status(500).json({ error: `Aufrufprotokoll konnte nicht gelesen werden: ${err.message}` });
  }
});

router.delete('/log', async (req, res) => {
  try {
    await llmLog.clear();
    res.json({ geloescht: true });
  } catch (err) {
    res.status(500).json({ error: `Aufrufprotokoll konnte nicht geleert werden: ${err.message}` });
  }
});

module.exports = router;
