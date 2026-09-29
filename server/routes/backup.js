const express = require('express');
const storage = require('../lib/storage');
const { runBackup } = require('../lib/backup');

const router = express.Router();

router.post('/', async (req, res) => {
  // Express 4 reicht Fehler aus async-Routen nicht weiter.
  try {
    res.json(await runBackup());
  } catch (err) {
    res.status(500).json({ error: 'Backup fehlgeschlagen: ' + err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    res.json({ letztesBackup: await storage.lastBackupInfo() });
  } catch (err) {
    res.status(500).json({ error: 'Backup-Status nicht lesbar: ' + err.message });
  }
});

module.exports = router;
