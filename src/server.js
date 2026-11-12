const http = require('http');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { createStore } = require('./store');
const { registerSocketHandlers } = require('./socket');

function createServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { maxHttpBufferSize: 10_000 });
  const store = createStore();
  registerSocketHandlers(io, store);
  return { app, httpServer, io, store };
}

function start(port = Number(process.env.PORT) || 3000) {
  const { httpServer, io } = createServer();

  httpServer.listen(port, () => {
    console.log(`ChatRooms listening on http://localhost:${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    io.close();
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
