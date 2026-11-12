function createStore() {
  // roomKey -> { name, users: Map<socketId, displayName>, history: Message[] }
  const rooms = new Map();

  function getOrCreateRoom(roomKey, roomName) {
    let room = rooms.get(roomKey);
    if (!room) {
      room = { name: roomName, users: new Map(), history: [] };
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
    const name = uniqueName(room, desiredName);
    room.users.set(socketId, name);
    return { name, roomName: room.name };
  }

  function removeUser(roomKey, socketId) {
    const room = rooms.get(roomKey);
    if (!room) return null;
    const name = room.users.get(socketId) || null;
    room.users.delete(socketId);
    if (room.users.size === 0) rooms.delete(roomKey);
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
    room.history.push(message);
  }

  function getHistory(roomKey) {
    const room = rooms.get(roomKey);
    return room ? [...room.history] : [];
  }

  function hasRoom(roomKey) {
    return rooms.has(roomKey);
  }

  return { addUser, removeUser, getUsers, addMessage, getHistory, hasRoom };
}

module.exports = { createStore };
