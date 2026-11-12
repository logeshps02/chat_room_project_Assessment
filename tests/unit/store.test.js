const { createStore, MAX_HISTORY_MESSAGES, EMPTY_ROOM_TTL_MS } = require('../../src/store');

describe('store', () => {
  let store;
  beforeEach(() => {
    jest.useFakeTimers();
    store = createStore();
  });

  afterEach(() => {
    store.dispose();
    jest.useRealTimers();
  });

  test('uses the specified 50-message and ten-minute retention limits', () => {
    expect(MAX_HISTORY_MESSAGES).toBe(50);
    expect(EMPTY_ROOM_TTL_MS).toBe(10 * 60 * 1000);
  });

  test('adds and lists users sorted by name', () => {
    store.addUser('general', 'General', 's1', 'Zed');
    store.addUser('general', 'General', 's2', 'Amy');
    expect(store.getUsers('general')).toEqual(['Amy', 'Zed']);
  });

  test('keeps the first display name used for the room', () => {
    store.addUser('general', 'General', 's1', 'A');
    const r = store.addUser('general', 'GENERAL', 's2', 'B');
    expect(r.roomName).toBe('General');
  });

  test('de-duplicates names case-insensitively', () => {
    expect(store.addUser('r', 'r', 's1', 'Alice').name).toBe('Alice');
    expect(store.addUser('r', 'r', 's2', 'alice').name).toBe('alice (2)');
    expect(store.addUser('r', 'r', 's3', 'Alice').name).toBe('Alice (3)');
  });

  test('allows the same name in different rooms', () => {
    store.addUser('a', 'a', 's1', 'Alice');
    expect(store.addUser('b', 'b', 's2', 'Alice').name).toBe('Alice');
  });

  test('removeUser returns the name and updates the list', () => {
    store.addUser('r', 'r', 's1', 'Alice');
    store.addUser('r', 'r', 's2', 'Bob');
    expect(store.removeUser('r', 's1')).toBe('Alice');
    expect(store.getUsers('r')).toEqual(['Bob']);
  });

  test('keeps an empty room until the ten-minute expiry', () => {
    store.addUser('r', 'r', 's1', 'Alice');
    store.addMessage('r', { id: '1', text: 'hello' });
    store.removeUser('r', 's1');
    expect(store.hasRoom('r')).toBe(true);
    expect(store.getUsers('r')).toEqual([]);
    expect(store.getHistory('r')).toEqual([{ id: '1', text: 'hello' }]);

    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS - 1);
    expect(store.hasRoom('r')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(store.hasRoom('r')).toBe(false);
    expect(store.getHistory('r')).toEqual([]);
  });

  test('removeUser on unknown room/socket is safe', () => {
    expect(store.removeUser('nope', 's1')).toBeNull();
    store.addUser('r', 'r', 's1', 'Alice');
    expect(store.removeUser('r', 'unknown')).toBeNull();
  });

  test('stores and returns message history in order', () => {
    store.addUser('r', 'r', 's1', 'Alice');
    store.addMessage('r', { id: '1', text: 'a' });
    store.addMessage('r', { id: '2', text: 'b' });
    expect(store.getHistory('r').map((m) => m.id)).toEqual(['1', '2']);
    expect(store.getHistory('missing')).toEqual([]);
  });

  test('retains the newest 50 messages in order across ring-buffer wraps', () => {
    store.addUser('r', 'r', 's1', 'Alice');
    for (let i = 1; i <= 60; i += 1) {
      store.addMessage('r', { id: String(i), text: `message ${i}` });
    }

    expect(store.getHistory('r')).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(store.getHistory('r').map((message) => message.id)).toEqual(
      Array.from({ length: MAX_HISTORY_MESSAGES }, (_, index) => String(index + 11))
    );

    for (let i = 61; i <= 160; i += 1) {
      store.addMessage('r', { id: String(i), text: `message ${i}` });
    }
    expect(store.getHistory('r').map((message) => message.id)).toEqual(
      Array.from({ length: MAX_HISTORY_MESSAGES }, (_, index) => String(index + 111))
    );
    const snapshot = store.getHistory('r');
    snapshot.pop();
    expect(store.getHistory('r')).toHaveLength(MAX_HISTORY_MESSAGES);
  });

  test('history is isolated by room', () => {
    store.addUser('a', 'A', 's1', 'Alice');
    store.addUser('b', 'B', 's2', 'Bob');
    store.addMessage('a', { id: 'a1' });
    store.addMessage('b', { id: 'b1' });
    expect(store.getHistory('a')).toEqual([{ id: 'a1' }]);
    expect(store.getHistory('b')).toEqual([{ id: 'b1' }]);
  });

  test('does not expire a room while it still has members', () => {
    store.addUser('r', 'r', 's1', 'Alice');
    store.addUser('r', 'r', 's2', 'Bob');
    store.removeUser('r', 's1');
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS * 2);
    expect(store.hasRoom('r')).toBe(true);
    expect(store.getUsers('r')).toEqual(['Bob']);
  });

  test('rejoining cancels expiry and a later departure starts a new countdown', () => {
    store.addUser('r', 'Room', 's1', 'Alice');
    store.addMessage('r', { id: '1', text: 'still here' });
    store.removeUser('r', 's1');
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS / 2);

    expect(store.addUser('r', 'ROOM', 's2', 'Bob').roomName).toBe('Room');
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS);
    expect(store.hasRoom('r')).toBe(true);
    expect(store.getHistory('r')).toEqual([{ id: '1', text: 'still here' }]);
    expect(store.getUsers('r')).toEqual(['Bob']);

    store.removeUser('r', 's2');
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS - 1);
    expect(store.hasRoom('r')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(store.hasRoom('r')).toBe(false);
  });

  test('removing an unknown user does not extend an empty room expiry', () => {
    store.addUser('r', 'r', 's1', 'Alice');
    store.removeUser('r', 's1');
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS / 2);
    expect(store.removeUser('r', 'unknown')).toBeNull();
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS / 2);
    expect(store.hasRoom('r')).toBe(false);
  });

  test('empty rooms expire independently based on their last departure', () => {
    store.addUser('a', 'A', 's1', 'Alice');
    store.addUser('b', 'B', 's2', 'Bob');
    store.removeUser('a', 's1');
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS / 2);
    store.removeUser('b', 's2');
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS / 2);
    expect(store.hasRoom('a')).toBe(false);
    expect(store.hasRoom('b')).toBe(true);
    jest.advanceTimersByTime(EMPTY_ROOM_TTL_MS / 2);
    expect(store.hasRoom('b')).toBe(false);
  });

  test('dispose clears rooms and outstanding expiry timers', () => {
    store.addUser('r', 'r', 's1', 'Alice');
    store.removeUser('r', 's1');
    expect(jest.getTimerCount()).toBe(1);
    store.dispose();
    expect(store.hasRoom('r')).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});
