const express = require('express');
const { runProjectBackup, getProjectBackupStatus } = require('../lib/project-backup');

const router = express.Router();

// Express 4 reicht Fehler aus async-Routen nicht weiter.
async function run(req, res) {
  try {
    res.json(await runProjectBackup('manuell'));
  } catch (err) {
    res.status(500).json({ error: 'Backup fehlgeschlagen: ' + err.message });
  }
}
router.post('/', run); // Alias für ältere Aufrufer
router.post('/run', run);

router.get('/status', async (req, res) => {
  try {
    res.json(await getProjectBackupStatus());
  } catch (err) {
    res.status(500).json({ error: 'Backup-Status nicht lesbar: ' + err.message });
  }
});

module.exports = router;
