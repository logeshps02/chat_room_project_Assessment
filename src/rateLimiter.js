const DEFAULT_MESSAGE_CAPACITY = 5;
const DEFAULT_MESSAGE_WINDOW_MS = 3000;
const DEFAULT_JOIN_LIMIT = 10;
const DEFAULT_JOIN_WINDOW_MS = 60_000;

function createRateLimiter({
  messageCapacity = DEFAULT_MESSAGE_CAPACITY,
  messageWindowMs = DEFAULT_MESSAGE_WINDOW_MS,
  joinLimit = DEFAULT_JOIN_LIMIT,
  joinWindowMs = DEFAULT_JOIN_WINDOW_MS,
  now = Date.now,
} = {}) {
  if (!Number.isInteger(messageCapacity) || messageCapacity < 1) {
    throw new RangeError('messageCapacity must be a positive integer');
  }
  if (!Number.isFinite(messageWindowMs) || messageWindowMs <= 0) {
    throw new RangeError('messageWindowMs must be a positive number');
  }
  if (!Number.isInteger(joinLimit) || joinLimit < 1) {
    throw new RangeError('joinLimit must be a positive integer');
  }
  if (!Number.isFinite(joinWindowMs) || joinWindowMs <= 0) {
    throw new RangeError('joinWindowMs must be a positive number');
  }
  if (typeof now !== 'function') {
    throw new TypeError('now must be a function');
  }

  const sockets = new Map();

  function getState(socketId) {
    let state = sockets.get(socketId);
    if (!state) {
      const time = now();
      state = {
        messageTokens: messageCapacity,
        messageUpdatedAt: time,
        joinCount: 0,
        joinWindowStartedAt: time,
      };
      sockets.set(socketId, state);
    }
    return state;
  }

  function allowMessage(socketId) {
    const state = getState(socketId);
    const time = now();
    const elapsed = Math.max(0, time - state.messageUpdatedAt);
    state.messageTokens = Math.min(
      messageCapacity,
      state.messageTokens + (elapsed * messageCapacity) / messageWindowMs
    );
    state.messageUpdatedAt = time;
    if (state.messageTokens < 1) return false;
    state.messageTokens -= 1;
    return true;
  }

  function allowJoin(socketId) {
    const state = getState(socketId);
    const time = now();
    if (time - state.joinWindowStartedAt >= joinWindowMs) {
      state.joinWindowStartedAt = time;
      state.joinCount = 0;
    }
    if (state.joinCount >= joinLimit) return false;
    state.joinCount += 1;
    return true;
  }

  function removeSocket(socketId) {
    sockets.delete(socketId);
  }

  function dispose() {
    sockets.clear();
  }

  return { allowMessage, allowJoin, removeSocket, dispose };
}

module.exports = {
  createRateLimiter,
  DEFAULT_MESSAGE_CAPACITY,
  DEFAULT_MESSAGE_WINDOW_MS,
  DEFAULT_JOIN_LIMIT,
  DEFAULT_JOIN_WINDOW_MS,
};
