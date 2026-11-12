const MAX_HISTORY_MESSAGES = 50;
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

function createStore() {
  const rooms = new Map();

  function getOrCreateRoom(roomKey, roomName) {
    let room = rooms.get(roomKey);
    if (!room) {
      room = {
        name: roomName,
        users: new Map(),
        history: [],
        historyStart: 0,
        cleanupTimer: null,
      };
      rooms.set(roomKey, room);
    }
    return room;
  }

  function uniqueName(room, desired) {
    const taken = new Set([...room.users.values()].map((n) => n.toLowerCase()));
    if (!taken.has(desired.toLowerCase())) return desired;
    let i = 2;
    while (taken.has(`${desired} (${i})`.toLowerCase())) i += 1;
    return `${desired} (${i})`;
  }

  function addUser(roomKey, roomName, socketId, desiredName) {
    const room = getOrCreateRoom(roomKey, roomName);
    if (room.cleanupTimer !== null) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
    const name = uniqueName(room, desiredName);
    room.users.set(socketId, name);
    return { name, roomName: room.name };
  }

  function removeUser(roomKey, socketId) {
    const room = rooms.get(roomKey);
    if (!room) return null;
    const name = room.users.get(socketId);
    if (name === undefined) return null;
    room.users.delete(socketId);
    if (room.users.size === 0) {
      const timer = setTimeout(() => {
        if (room.cleanupTimer === timer && room.users.size === 0 && rooms.get(roomKey) === room) {
          rooms.delete(roomKey);
        }
      }, EMPTY_ROOM_TTL_MS);
      room.cleanupTimer = timer;
      timer.unref();
    }
    return name;
  }

  function getUsers(roomKey) {
    const room = rooms.get(roomKey);
    if (!room) return [];
    return [...room.users.values()].sort((a, b) => a.localeCompare(b));
  }

  function addMessage(roomKey, message) {
    const room = rooms.get(roomKey);
    if (!room) return;
    if (room.history.length < MAX_HISTORY_MESSAGES) {
      room.history.push(message);
    } else {
      // Replace the oldest entry, then advance the ring's starting index.
      room.history[room.historyStart] = message;
      room.historyStart = (room.historyStart + 1) % MAX_HISTORY_MESSAGES;
    }
  }

  function getHistory(roomKey) {
    const room = rooms.get(roomKey);
    if (!room) return [];
    return room.history.slice(room.historyStart).concat(room.history.slice(0, room.historyStart));
  }

  function hasRoom(roomKey) {
    return rooms.has(roomKey);
  }

  function dispose() {
    for (const room of rooms.values()) {
      if (room.cleanupTimer !== null) clearTimeout(room.cleanupTimer);
    }
    rooms.clear();
  }

  return { addUser, removeUser, getUsers, addMessage, getHistory, hasRoom, dispose };
}

module.exports = { createStore, MAX_HISTORY_MESSAGES, EMPTY_ROOM_TTL_MS };
