const crypto = require('crypto');
const { validateName, validateRoom, validateMessage } = require('./validation');

const TYPING_IDLE_MS = 3000;

function systemMessage(text) {
  return { id: crypto.randomUUID(), text, ts: new Date().toISOString(), type: 'system' };
}

function registerSocketHandlers(io, store) {
  function stopTyping(socket) {
    const { name, roomKey, isTyping, typingTimer } = socket.data;
    if (typingTimer) clearTimeout(typingTimer);
    socket.data.typingTimer = null;
    socket.data.isTyping = false;
    if (isTyping && roomKey) {
      socket.to(roomKey).emit('typing', { name, isTyping: false });
    }
  }

  function leaveCurrentRoom(socket) {
    const { roomKey } = socket.data;
    if (!roomKey) return;
    stopTyping(socket);
    const name = store.removeUser(roomKey, socket.id);
    socket.leave(roomKey);
    socket.data = {};
    if (name) {
      io.to(roomKey).emit('system', systemMessage(`${name} left the room`));
      io.to(roomKey).emit('room:users', { users: store.getUsers(roomKey) });
    }
  }

  io.on('connection', (socket) => {
    socket.data = {};

    socket.on('room:join', (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const { name, room } = payload && typeof payload === 'object' ? payload : {};

      const nameCheck = validateName(name);
      if (!nameCheck.ok) return reply({ ok: false, error: nameCheck.error });
      const roomCheck = validateRoom(room);
      if (!roomCheck.ok) return reply({ ok: false, error: roomCheck.error });

      leaveCurrentRoom(socket);

      const roomKey = roomCheck.key;
      const joined = store.addUser(roomKey, roomCheck.value, socket.id, nameCheck.value);
      socket.join(roomKey);
      socket.data = { name: joined.name, roomKey, roomName: joined.roomName };

      const users = store.getUsers(roomKey);
      reply({
        ok: true,
        user: { name: joined.name },
        room: joined.roomName,
        users,
        history: store.getHistory(roomKey),
      });

      socket.to(roomKey).emit('system', systemMessage(`${joined.name} joined the room`));
      io.to(roomKey).emit('room:users', { users });
    });

    socket.on('message:send', (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const { name, roomKey, roomName } = socket.data;
      if (!roomKey) return reply({ ok: false, error: 'Join a room first' });

      const text = payload && typeof payload === 'object' ? payload.text : undefined;
      const check = validateMessage(text);
      if (!check.ok) return reply({ ok: false, error: check.error });

      const message = {
        id: crypto.randomUUID(),
        room: roomName,
        name,
        text: check.value,
        ts: new Date().toISOString(),
        type: 'user',
      };
      stopTyping(socket);
      store.addMessage(roomKey, message);
      io.to(roomKey).emit('message:new', message);
      reply({ ok: true, id: message.id });
    });

    socket.on('typing', (payload) => {
      const { name, roomKey, isTyping } = socket.data;
      if (!roomKey) return;
      if (!payload || payload.isTyping !== true) {
        stopTyping(socket);
        return;
      }

      if (!isTyping) {
        socket.data.isTyping = true;
        socket.to(roomKey).emit('typing', { name, isTyping: true });
      }
      if (socket.data.typingTimer) clearTimeout(socket.data.typingTimer);
      socket.data.typingTimer = setTimeout(() => stopTyping(socket), TYPING_IDLE_MS);
      socket.data.typingTimer.unref();
    });

    socket.on('disconnect', () => leaveCurrentRoom(socket));
  });
}

module.exports = { registerSocketHandlers, TYPING_IDLE_MS };
