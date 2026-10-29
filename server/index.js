const config = require('./lib/config'); // lädt .env, bevor andere Module process.env lesen
const express = require('express');
const path = require('path');
const fs = require('fs');
const projectsRouter = require('./routes/projects');
const ticketsRouter = require('./routes/tickets');
const backupRouter = require('./routes/backup');
const integrityRouter = require('./routes/integrity');
const llmRouter = require('./routes/llm');
const { checkIntegrity } = require('./lib/integrity');
const { startScheduler } = require('./lib/project-backup');
const { listModels, providerStatus, settingsStatus, systemPromptsStatus, saveSystemPrompt, saveKey, clearKey, saveBaseUrl, clearBaseUrl, saveCustomModel, fetchProviderModels, DEFAULT_MODEL, LlmError } = require('./lib/llm');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

const app = express();
const { host: HOST, port: PORT } = config.server;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API-Antworten nie cachen, damit die Liste nach Änderungen/Löschen aktuell ist.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Verfügbare LLM-Modelle + Anbieter-Status (welcher Key ist gesetzt?)
app.get('/api/models', (req, res) => {
  res.json({ models: listModels(), default: DEFAULT_MODEL, providers: providerStatus() });
});

// Einstellungen: API-Keys per UI verwalten (werden serverseitig in Dateien
// im Projektordner geschrieben, niemals ans Frontend zurückgegeben)
app.get('/api/settings', (req, res) => {
  res.json({ providers: settingsStatus(), systemPrompts: systemPromptsStatus() });
});

// Globale System-Anweisung setzen/zurücksetzen (leerer Text = Standard)
app.post('/api/settings/system-prompt/:key', (req, res) => {
  try {
    saveSystemPrompt(req.params.key, req.body.text);
    res.json({ systemPrompts: systemPromptsStatus() });
  } catch (err) {
    if (err instanceof LlmError) {
      res.status(400).json({ error: err.message, code: err.code });
    } else {
      res.status(500).json({ error: 'Interner Fehler beim Speichern der Anweisung.' });
    }
  }
});

app.post('/api/settings/:provider', (req, res) => {
  try {
    saveKey(req.params.provider, req.body.key);
    res.json({ providers: settingsStatus() });
  } catch (err) {
    if (err instanceof LlmError) {
      res.status(400).json({ error: err.message, code: err.code });
    } else {
      res.status(500).json({ error: 'Interner Fehler beim Speichern.' });
    }
  }
});

app.delete('/api/settings/:provider', (req, res) => {
  try {
    clearKey(req.params.provider);
    res.json({ providers: settingsStatus() });
  } catch (err) {
    res.status(500).json({ error: 'Interner Fehler beim Löschen.' });
  }
});

// Basis-URL für Anbieter mit eigenem Server (z. B. Firmen-LiteLLM-Proxy)
app.post('/api/settings/:provider/base-url', (req, res) => {
  try {
    saveBaseUrl(req.params.provider, req.body.url);
    res.json({ providers: settingsStatus() });
  } catch (err) {
    if (err instanceof LlmError) {
      res.status(400).json({ error: err.message, code: err.code });
    } else {
      res.status(500).json({ error: 'Interner Fehler beim Speichern der Basis-URL.' });
    }
  }
});

app.delete('/api/settings/:provider/base-url', (req, res) => {
  try {
    clearBaseUrl(req.params.provider);
    res.json({ providers: settingsStatus() });
  } catch (err) {
    res.status(500).json({ error: 'Interner Fehler beim Löschen der Basis-URL.' });
  }
});

// Modell-Liste eines Anbieters live abrufen und lokal zwischenspeichern.
// Passiert ausschließlich auf ausdrückliche Anforderung, nie beim App-Start.
app.post('/api/settings/:provider/fetch-models', async (req, res) => {
  try {
    const result = await fetchProviderModels(req.params.provider);
    res.json({ ...result, providers: settingsStatus() });
  } catch (err) {
    if (err instanceof LlmError) {
      const status = err.code === 'NO_KEY' ? 501 : err.code === 'BAD_PROVIDER' ? 400 : 502;
      res.status(status).json({ error: err.message, code: err.code });
    } else {
      res.status(500).json({ error: 'Interner Fehler beim Modell-Abruf.' });
    }
  }
});

// Eigenes Modell pro Anbieter setzen/leeren (leerer Wert = zurücksetzen)
app.post('/api/settings/:provider/model', (req, res) => {
  try {
    saveCustomModel(req.params.provider, req.body.model);
    res.json({ providers: settingsStatus() });
  } catch (err) {
    if (err instanceof LlmError) {
      res.status(400).json({ error: err.message, code: err.code });
    } else {
      res.status(500).json({ error: 'Interner Fehler beim Speichern des Modells.' });
    }
  }
});

// App-Version (für UI)
app.get('/api/version', (req, res) => {
  res.json({ version: pkg.version });
});

app.use('/api/backup', backupRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/tickets', ticketsRouter);
app.use('/api/integrity', integrityRouter);
app.use('/api/llm', llmRouter);

// Letzte Instanz: unerwartete Fehler als JSON melden statt die Anfrage hängen zu lassen.
app.use((err, req, res, next) => {
  console.error(`[Server] ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Interner Fehler: ' + err.message });
});

app.listen(PORT, HOST, () => {
  console.log(`IT-Ideenforum läuft auf http://localhost:${PORT}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.log(`[Hinweis] HOST=${HOST} – der Server ist ohne Anmeldung im Netzwerk erreichbar.`);
  }
  startScheduler();
  checkIntegrity()
    .then((r) => console.log(`[Integrität] ${r.geprueft.projekte} Projekt(e), ${r.geprueft.tickets} Ticket(s) geprüft – ${r.anzahl.fehler} Fehler, ${r.anzahl.warnungen} Warnung(en)`))
    .catch((err) => console.error('[Integrität] Prüfung fehlgeschlagen:', err.message));
});
