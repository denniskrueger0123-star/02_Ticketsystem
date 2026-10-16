const express = require('express');
const { checkIntegrity, repairIntegrity } = require('../lib/integrity');

const router = express.Router();

router.get('/check', async (req, res) => {
  try {
    res.json(await checkIntegrity());
  } catch (err) {
    res.status(500).json({ error: `Integritätsprüfung fehlgeschlagen: ${err.message}` });
  }
});

router.post('/repair', async (req, res) => {
  try {
    res.json(await repairIntegrity());
  } catch (err) {
    res.status(500).json({ error: `Reparatur fehlgeschlagen: ${err.message}` });
  }
});

module.exports = router;
