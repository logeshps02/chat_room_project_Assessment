const http = require('http');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { createStore } = require('./store');
const { registerSocketHandlers } = require('./socket');
const { createRateLimiter } = require('./rateLimiter');
const { createIpLimiter, getClientIp } = require('./ipLimiter');

function isSameOriginRequest(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers.host;
  if (typeof host !== 'string') return false;
  try {
    const parsedOrigin = new URL(origin);
    return (
      (parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:') &&
      parsedOrigin.host.toLowerCase() === host.toLowerCase()
    );
  } catch {
    return false;
  }
}

function createServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 10_000,
    cors: { origin: false },
    allowRequest: (request, callback) => {
      if (!isSameOriginRequest(request)) return callback('Origin not allowed', false);
      callback(null, true);
    },
  });
  const store = createStore();
  const rateLimiter = createRateLimiter();
  const ipLimiter = createIpLimiter();
  io.use((socket, next) => {
    const clientIp = getClientIp(socket.handshake.headers, socket.handshake.address);
    if (!ipLimiter.connect(clientIp)) {
      return next(new Error('Too many connections from this address'));
    }
    socket.data.clientIp = clientIp;
    next();
  });
  registerSocketHandlers(io, store, rateLimiter);
  io.on('connection', (socket) => {
    socket.once('disconnect', () => ipLimiter.disconnect(socket.data.clientIp));
  });
  httpServer.on('close', () => {
    store.dispose();
    rateLimiter.dispose();
    ipLimiter.dispose();
  });
  return { app, httpServer, io, store, rateLimiter, ipLimiter };
}

function start(port = Number(process.env.PORT) || 3000, host = process.env.HOST || '127.0.0.1') {
  const { httpServer, io } = createServer();

  httpServer.listen(port, host, () => {
    console.log(`ChatRooms listening on http://${host}:${port}`);
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

module.exports = { createServer, start, isSameOriginRequest };
