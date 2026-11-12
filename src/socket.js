const crypto = require('crypto');
const { validateName, validateRoom, validateMessage } = require('./validation');

function systemMessage(text) {
  return { id: crypto.randomUUID(), text, ts: new Date().toISOString(), type: 'system' };
}

function registerSocketHandlers(io, store) {
  function leaveCurrentRoom(socket) {
    const { roomKey } = socket.data;
    if (!roomKey) return;
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
      store.addMessage(roomKey, message);
      io.to(roomKey).emit('message:new', message);
      reply({ ok: true, id: message.id });
    });

    socket.on('disconnect', () => leaveCurrentRoom(socket));
  });
}

module.exports = { registerSocketHandlers };
