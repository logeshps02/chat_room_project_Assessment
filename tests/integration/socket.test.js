const { startTestServer, emitAck, waitFor, collect, sleep } = require('./helpers');

describe('Socket.IO chat', () => {
  let server;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.close();
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
