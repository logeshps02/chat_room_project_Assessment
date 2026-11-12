const path = require('path');
const express = require('express');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  app.get('/js/validation.js', (_req, res) => {
    res.type('application/javascript').sendFile(path.join(__dirname, 'validation.js'));
  });

  app.use(express.static(PUBLIC_DIR));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });

  return app;
}

module.exports = { createApp };
