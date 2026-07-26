const express = require('express');
const path = require('path');
const projectsRouter = require('./routes/projects');
const ticketsRouter = require('./routes/tickets');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/tickets', ticketsRouter);

app.listen(PORT, () => {
  console.log(`IT-Ideenforum läuft auf http://localhost:${PORT}`);
});
