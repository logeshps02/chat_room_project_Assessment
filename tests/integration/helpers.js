const { io: ioClient } = require('socket.io-client');
const { createServer } = require('../../src/server');

async function startTestServer() {
  const server = createServer();
  await new Promise((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = server.httpServer.address();
  const url = `http://127.0.0.1:${port}`;
  const clients = [];

  function connect(opts = {}) {
    const socket = ioClient(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...opts,
    });
    clients.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  async function close() {
    clients.forEach((c) => c.disconnect());
    server.io.close();
    await new Promise((resolve) => server.httpServer.close(() => resolve()));
  }

  return { ...server, url, port, connect, close };
}

function emitAck(socket, event, payload, timeout = 2000) {
  return socket.timeout(timeout).emitWithAck(event, payload);
}

function waitFor(socket, event, predicate = () => true, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeout);
    function handler(data) {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    }
    socket.on(event, handler);
  });
}

function collect(socket, event) {
  const items = [];
  socket.on(event, (data) => items.push(data));
  return items;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { startTestServer, emitAck, waitFor, collect, sleep };
