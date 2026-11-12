const http = require('http');
const { createApp } = require('./app');

function createServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  return { app, httpServer };
}

function start(port = Number(process.env.PORT) || 3000) {
  const { httpServer } = createServer();

  httpServer.listen(port, () => {
    console.log(`ChatRooms listening on http://localhost:${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return httpServer;
}

if (require.main === module) {
  start();
}

module.exports = { createServer, start };
