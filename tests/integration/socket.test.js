const { startTestServer, emitAck, waitFor, collect, sleep } = require('./helpers');

describe('Socket.IO chat', () => {
  let server;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    if (server) await server.close();
  });

  async function joined(name, room) {
    const socket = await server.connect();
    const ack = await emitAck(socket, 'room:join', { name, room });
    expect(ack.ok).toBe(true);
    return { socket, ack };
  }

  test('1. joining a room acks with user, users and empty history', async () => {
    const { ack } = await joined('Alice', 'general');
    expect(ack).toEqual({
      ok: true,
      user: { name: 'Alice' },
      room: 'general',
      users: ['Alice'],
      history: [],
    });
  });

  test('2. a message is delivered live to everyone in the room (incl. sender)', async () => {
    const { socket: a } = await joined('Alice', 'general');
    const { socket: b } = await joined('Bob', 'general');

    const gotA = waitFor(a, 'message:new');
    const gotB = waitFor(b, 'message:new');
    const ack = await emitAck(a, 'message:send', { text: 'hi' });
    expect(ack.ok).toBe(true);

    const [ma, mb] = await Promise.all([gotA, gotB]);
    for (const m of [ma, mb]) {
      expect(m).toMatchObject({ name: 'Alice', text: 'hi', room: 'general', type: 'user' });
      expect(m.id).toBe(ack.id);
    }
  });

  test('3. rooms are isolated', async () => {
    const { socket: a } = await joined('Alice', 'general');
    const { socket: b } = await joined('Bob', 'general');
    const { socket: c } = await joined('Carol', 'random');
    const cMessages = collect(c, 'message:new');

    const gotB = waitFor(b, 'message:new');
    await emitAck(a, 'message:send', { text: 'only for general' });
    await gotB;
    await sleep(150);
    expect(cMessages).toHaveLength(0);
  });

  test('4. messages carry a server ISO timestamp close to now', async () => {
    const { socket: a } = await joined('Alice', 'general');
    const got = waitFor(a, 'message:new');
    await emitAck(a, 'message:send', { text: 'time?' });
    const m = await got;
    expect(m.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Math.abs(Date.parse(m.ts) - Date.now())).toBeLessThan(5000);
  });

  test('5. sending before joining is rejected and not broadcast', async () => {
    const { socket: a } = await joined('Alice', 'general');
    const outsider = await server.connect();
    const aMessages = collect(a, 'message:new');
    const ack = await emitAck(outsider, 'message:send', { text: 'sneaky' });
    expect(ack).toEqual({ ok: false, error: 'Join a room first' });
    await sleep(100);
    expect(aMessages).toHaveLength(0);
  });

  test('6. empty and too-long messages are rejected', async () => {
    const { socket: a } = await joined('Alice', 'general');
    const aMessages = collect(a, 'message:new');
    expect((await emitAck(a, 'message:send', { text: '   ' })).ok).toBe(false);
    expect((await emitAck(a, 'message:send', { text: 'x'.repeat(1001) })).ok).toBe(false);
    expect((await emitAck(a, 'message:send', null)).ok).toBe(false);
    await sleep(100);
    expect(aMessages).toHaveLength(0);
  });

  test('7. existing members are told when someone joins', async () => {
    const { socket: a } = await joined('Alice', 'general');
    const sys = waitFor(a, 'system', (m) => m.text === 'Bob joined the room');
    const users = waitFor(a, 'room:users', (u) => u.users.length === 2);
    const { ack } = await joined('Bob', 'general');
    expect(ack.users).toEqual(['Alice', 'Bob']);
    const s = await sys;
    expect(s.type).toBe('system');
    expect((await users).users).toEqual(['Alice', 'Bob']);
  });

  test('8. members are told when someone disconnects', async () => {
    const { socket: a } = await joined('Alice', 'general');
    const { socket: b } = await joined('Bob', 'general');
    const sys = waitFor(a, 'system', (m) => m.text === 'Bob left the room');
    const users = waitFor(a, 'room:users', (u) => u.users.length === 1);
    b.disconnect();
    await sys;
    expect((await users).users).toEqual(['Alice']);
  });

  test('9. duplicate names in the same room get a suffix', async () => {
    await joined('Alice', 'general');
    const { ack } = await joined('Alice', 'general');
    expect(ack.user.name).toBe('Alice (2)');
    expect(ack.users).toEqual(['Alice', 'Alice (2)']);
  });

  test('10. room names are case-insensitive', async () => {
    const { socket: a } = await joined('Alice', 'General');
    const { socket: b, ack } = await joined('Bob', 'general');
    expect(ack.room).toBe('General');
    expect(ack.users).toEqual(['Alice', 'Bob']);
    const got = waitFor(b, 'message:new');
    await emitAck(a, 'message:send', { text: 'same room' });
    expect((await got).text).toBe('same room');
  });

  test('late joiners receive earlier messages in order, without history from other rooms', async () => {
    const { socket: a } = await joined('Alice', 'general');
    for (const text of ['one', 'two', 'three']) {
      expect((await emitAck(a, 'message:send', { text })).ok).toBe(true);
    }

    const { ack } = await joined('Bob', 'general');
    expect(ack.history.map((message) => message.text)).toEqual(['one', 'two', 'three']);
    for (const message of ack.history) {
      expect(message).toMatchObject({ name: 'Alice', room: 'general', type: 'user' });
      expect(message.id).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(message.ts))).toBe(false);
    }

    const { ack: otherRoom } = await joined('Carol', 'random');
    expect(otherRoom.history).toEqual([]);
  });

  test('a late joiner receives only the latest 50 messages', async () => {
    const { socket: a } = await joined('Alice', 'general');
    for (let i = 1; i <= 60; i += 1) {
      expect((await emitAck(a, 'message:send', { text: `message ${i}` })).ok).toBe(true);
    }

    const { ack } = await joined('Bob', 'general');
    expect(ack.history).toHaveLength(50);
    expect(ack.history.map((message) => message.text)).toEqual(
      Array.from({ length: 50 }, (_, index) => `message ${index + 11}`)
    );
  }, 15_000);

  test('history survives the last member leaving and is available on rejoin', async () => {
    const { socket: a } = await joined('Alice', 'General');
    expect((await emitAck(a, 'message:send', { text: 'still here' })).ok).toBe(true);
    const serverSocket = server.io.sockets.sockets.get(a.id);
    expect(serverSocket).toBeDefined();
    const disconnected = new Promise((resolve) => serverSocket.once('disconnect', resolve));
    a.disconnect();
    await disconnected;
    expect(server.store.getUsers('general')).toEqual([]);
    expect(server.store.hasRoom('general')).toBe(true);

    const { ack } = await joined('Bob', 'general');
    expect(ack.room).toBe('General');
    expect(ack.users).toEqual(['Bob']);
    expect(ack.history.map((message) => message.text)).toEqual(['still here']);
  });

  test('closing the server clears retained empty rooms', async () => {
    const { socket } = await joined('Alice', 'general');
    const serverSocket = server.io.sockets.sockets.get(socket.id);
    expect(serverSocket).toBeDefined();
    const disconnected = new Promise((resolve) => serverSocket.once('disconnect', resolve));
    socket.disconnect();
    await disconnected;
    const store = server.store;
    expect(store.hasRoom('general')).toBe(true);

    await server.close();
    server = null;
    expect(store.hasRoom('general')).toBe(false);
  });

  test('typing events reach room members but not the sender or other rooms', async () => {
    const { socket: alice } = await joined('Alice', 'general');
    const { socket: bob } = await joined('Bob', 'general');
    const { socket: carol } = await joined('Carol', 'random');
    const aliceEvents = collect(alice, 'typing');
    const carolEvents = collect(carol, 'typing');
    const bobStartsTyping = waitFor(bob, 'typing', (event) => event.isTyping === true);

    alice.emit('typing', { isTyping: true });
    expect(await bobStartsTyping).toEqual({ name: 'Alice', isTyping: true });

    const bobStopsTyping = waitFor(bob, 'typing', (event) => event.isTyping === false);
    alice.emit('typing', { isTyping: false });
    expect(await bobStopsTyping).toEqual({ name: 'Alice', isTyping: false });
    await sleep(100);
    expect(aliceEvents).toEqual([]);
    expect(carolEvents).toEqual([]);
  });

  test('typing is broadcast once per active burst even when true is repeated', async () => {
    const { socket: alice } = await joined('Alice', 'general');
    const { socket: bob } = await joined('Bob', 'general');
    const events = collect(bob, 'typing');
    const started = waitFor(bob, 'typing', (event) => event.isTyping);
    for (let i = 0; i < 10; i += 1) alice.emit('typing', { isTyping: true });
    await started;
    await sleep(100);
    expect(events).toEqual([{ name: 'Alice', isTyping: true }]);

    const stopped = waitFor(bob, 'typing', (event) => !event.isTyping);
    alice.emit('typing', { isTyping: false });
    await stopped;
  });

  test('typing state expires after three seconds without an update', async () => {
    const { socket: alice } = await joined('Alice', 'general');
    const { socket: bob } = await joined('Bob', 'general');
    const started = waitFor(bob, 'typing', (event) => event.isTyping);
    alice.emit('typing', { isTyping: true });
    await started;

    expect(await waitFor(bob, 'typing', (event) => !event.isTyping, 5000)).toEqual({
      name: 'Alice',
      isTyping: false,
    });
  }, 7000);

  test('sending a message clears typing state for other members', async () => {
    const { socket: alice } = await joined('Alice', 'general');
    const { socket: bob } = await joined('Bob', 'general');
    const started = waitFor(bob, 'typing', (event) => event.isTyping);
    alice.emit('typing', { isTyping: true });
    await started;

    const stopped = waitFor(bob, 'typing', (event) => !event.isTyping);
    const message = waitFor(bob, 'message:new', (event) => event.text === 'sent');
    await emitAck(alice, 'message:send', { text: 'sent' });
    await stopped;
    await message;
  });

  test('disconnecting while typing clears the indicator before the leave notice', async () => {
    const { socket: alice } = await joined('Alice', 'general');
    const { socket: bob } = await joined('Bob', 'general');
    const started = waitFor(bob, 'typing', (event) => event.isTyping);
    alice.emit('typing', { isTyping: true });
    await started;

    const stopped = waitFor(bob, 'typing', (event) => !event.isTyping);
    const left = waitFor(bob, 'system', (event) => event.text === 'Alice left the room');
    alice.disconnect();
    await stopped;
    await left;
  });

  test('typing events from a socket that has not joined a room are ignored', async () => {
    const { socket: bob } = await joined('Bob', 'general');
    const events = collect(bob, 'typing');
    const outsider = await server.connect();
    outsider.emit('typing', { isTyping: true });
    await sleep(150);
    expect(events).toEqual([]);
  });

  test('invalid join payloads are rejected', async () => {
    const s = await server.connect();
    expect(await emitAck(s, 'room:join', { name: '', room: 'r' })).toEqual({
      ok: false,
      error: 'Display name is required',
    });
    expect(await emitAck(s, 'room:join', { name: 'A', room: '<x>' })).toMatchObject({
      ok: false,
    });
    expect(await emitAck(s, 'room:join', 'garbage')).toMatchObject({ ok: false });
  });

  test('switching rooms leaves the previous room', async () => {
    const { socket: a } = await joined('Alice', 'general');
    const { socket: b } = await joined('Bob', 'general');
    const left = waitFor(a, 'system', (m) => m.text === 'Bob left the room');
    const ack = await emitAck(b, 'room:join', { name: 'Bob', room: 'random' });
    expect(ack.room).toBe('random');
    await left;
    expect(server.store.getUsers('general')).toEqual(['Alice']);
  });
});
