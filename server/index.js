const express = require('express');
const path = require('path');
const projectsRouter = require('./routes/projects');
const ticketsRouter = require('./routes/tickets');
const { listModels, providerStatus, DEFAULT_MODEL } = require('./lib/llm');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Verfügbare LLM-Modelle + Anbieter-Status (welcher Key ist gesetzt?)
app.get('/api/models', (req, res) => {
  res.json({ models: listModels(), default: DEFAULT_MODEL, providers: providerStatus() });
});

app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/tickets', ticketsRouter);

app.listen(PORT, () => {
  console.log(`IT-Ideenforum läuft auf http://localhost:${PORT}`);
});
