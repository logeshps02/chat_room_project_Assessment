const {
  createRateLimiter,
  DEFAULT_MESSAGE_CAPACITY,
  DEFAULT_MESSAGE_WINDOW_MS,
  DEFAULT_JOIN_LIMIT,
  DEFAULT_JOIN_WINDOW_MS,
} = require('../../src/rateLimiter');

describe('socket rate limiter', () => {
  let time;
  let limiter;

  beforeEach(() => {
    time = 0;
    limiter = createRateLimiter({ now: () => time });
  });

  test('allows a five-message burst and rejects the sixth within three seconds', () => {
    expect(DEFAULT_MESSAGE_CAPACITY).toBe(5);
    for (let i = 0; i < DEFAULT_MESSAGE_CAPACITY; i += 1) {
      expect(limiter.allowMessage('socket-a')).toBe(true);
    }
    expect(limiter.allowMessage('socket-a')).toBe(false);
  });

  test('refills message capacity evenly and is isolated per socket', () => {
    for (let i = 0; i < 5; i += 1) limiter.allowMessage('socket-a');
    expect(limiter.allowMessage('socket-b')).toBe(true);
    time = 600;
    expect(limiter.allowMessage('socket-a')).toBe(true);
    expect(limiter.allowMessage('socket-a')).toBe(false);
    time = DEFAULT_MESSAGE_WINDOW_MS;
    expect(limiter.allowMessage('socket-a')).toBe(true);
  });

  test('limits room joins to ten per minute and resets at the window boundary', () => {
    for (let i = 0; i < DEFAULT_JOIN_LIMIT; i += 1)
      expect(limiter.allowJoin('socket-a')).toBe(true);
    expect(limiter.allowJoin('socket-a')).toBe(false);
    time = DEFAULT_JOIN_WINDOW_MS;
    expect(limiter.allowJoin('socket-a')).toBe(true);
  });

  test('removes a disconnected socket state and clears all states on dispose', () => {
    limiter.allowMessage('socket-a');
    limiter.removeSocket('socket-a');
    expect(limiter.allowMessage('socket-a')).toBe(true);
    limiter.allowMessage('socket-b');
    limiter.dispose();
    expect(limiter.allowMessage('socket-b')).toBe(true);
  });

  test('rejects invalid limiter configuration', () => {
    expect(() => createRateLimiter({ messageCapacity: 0 })).toThrow(RangeError);
    expect(() => createRateLimiter({ messageWindowMs: 0 })).toThrow(RangeError);
    expect(() => createRateLimiter({ joinLimit: 0 })).toThrow(RangeError);
    expect(() => createRateLimiter({ now: 1 })).toThrow(TypeError);
  });
});
