const {
  createIpLimiter,
  getClientIp,
  normalizeIp,
  DEFAULT_CONNECTION_LIMIT,
} = require('../../src/ipLimiter');

describe('client IP connection limiter', () => {
  test('normalizes valid IPv4, IPv6 and IPv4-mapped IPv6 addresses', () => {
    expect(normalizeIp(' 203.0.113.8 ')).toBe('203.0.113.8');
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
    expect(normalizeIp('::ffff:192.0.2.4')).toBe('192.0.2.4');
    expect(normalizeIp('203.0.113.999')).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });

  test('uses Cloudflare client IP only when it is a valid IP address', () => {
    expect(getClientIp({ 'cf-connecting-ip': '203.0.113.8' }, '127.0.0.1')).toBe('203.0.113.8');
    expect(getClientIp({ 'cf-connecting-ip': 'spoofed, 203.0.113.8' }, '127.0.0.1')).toBe(
      '127.0.0.1'
    );
    expect(getClientIp({}, 'invalid')).toBe('unknown');
  });

  test('caps simultaneous connections per IP and releases capacity on disconnect', () => {
    const limiter = createIpLimiter(2);
    expect(limiter.connect('192.0.2.1')).toBe(true);
    expect(limiter.connect('192.0.2.1')).toBe(true);
    expect(limiter.connect('192.0.2.1')).toBe(false);
    expect(limiter.connect('192.0.2.2')).toBe(true);
    expect(limiter.count('192.0.2.1')).toBe(2);
    limiter.disconnect('192.0.2.1');
    expect(limiter.count('192.0.2.1')).toBe(1);
    expect(limiter.connect('192.0.2.1')).toBe(true);
    limiter.dispose();
    expect(limiter.count('192.0.2.1')).toBe(0);
  });

  test('uses the intended default connection limit', () => {
    expect(DEFAULT_CONNECTION_LIMIT).toBe(20);
    const limiter = createIpLimiter();
    for (let i = 0; i < DEFAULT_CONNECTION_LIMIT; i += 1) {
      expect(limiter.connect('127.0.0.1')).toBe(true);
    }
    expect(limiter.connect('127.0.0.1')).toBe(false);
  });

  test('rejects invalid connection limits', () => {
    expect(() => createIpLimiter(0)).toThrow(RangeError);
    expect(() => createIpLimiter(1.5)).toThrow(RangeError);
  });
});
