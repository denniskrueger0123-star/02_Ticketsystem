const express = require('express');
const storage = require('../lib/storage');
const { runBackup } = require('../lib/backup');
const { runProjectBackup, getProjectBackupStatus } = require('../lib/project-backup');

const router = express.Router();

router.post('/', async (req, res) => {
  // Express 4 reicht Fehler aus async-Routen nicht weiter.
  try {
    res.json(await runBackup());
  } catch (err) {
    res.status(500).json({ error: 'Backup fehlgeschlagen: ' + err.message });
  }
});

// Projekt-Backups (eine Datei pro Projekt, siehe lib/project-backup.js) – unabhängig vom Sammel-Backup oben.
router.post('/run', async (req, res) => {
  try {
    res.json(await runProjectBackup('manuell'));
  } catch (err) {
    res.status(500).json({ error: 'Projekt-Backup fehlgeschlagen: ' + err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const letztesBackup = await storage.lastBackupInfo();
    let projektBackups;
    try {
      projektBackups = await getProjectBackupStatus();
    } catch (err) {
      projektBackups = { fehler: 'Status der Projekt-Backups nicht lesbar: ' + err.message };
    }
    res.json({ letztesBackup, projektBackups });
  } catch (err) {
    res.status(500).json({ error: 'Backup-Status nicht lesbar: ' + err.message });
  }
});

module.exports = router;
