const { createStore } = require('../../src/store');

describe('store', () => {
  let store;
  beforeEach(() => {
    store = createStore();
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

  test('removing the last user cleans up the room', () => {
    store.addUser('r', 'r', 's1', 'Alice');
    store.removeUser('r', 's1');
    expect(store.hasRoom('r')).toBe(false);
    expect(store.getUsers('r')).toEqual([]);
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
});
