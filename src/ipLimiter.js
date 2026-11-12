const { isIP } = require('node:net');

const DEFAULT_CONNECTION_LIMIT = 20;

function normalizeIp(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  const mappedIpv4 = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIpv4) return isIP(mappedIpv4[1]) === 4 ? mappedIpv4[1] : null;
  return isIP(value) ? value.toLowerCase() : null;
}

function getClientIp(headers, remoteAddress) {
  const forwardedIp = normalizeIp(headers && headers['cf-connecting-ip']);
  return forwardedIp || normalizeIp(remoteAddress) || 'unknown';
}

function createIpLimiter(maxConnections = DEFAULT_CONNECTION_LIMIT) {
  if (!Number.isInteger(maxConnections) || maxConnections < 1) {
    throw new RangeError('maxConnections must be a positive integer');
  }

  const connectionsByIp = new Map();

  function connect(ip) {
    const key = normalizeIp(ip) || 'unknown';
    const count = connectionsByIp.get(key) || 0;
    if (count >= maxConnections) return false;
    connectionsByIp.set(key, count + 1);
    return true;
  }

  function disconnect(ip) {
    const key = normalizeIp(ip) || 'unknown';
    const count = connectionsByIp.get(key) || 0;
    if (count <= 1) {
      connectionsByIp.delete(key);
      return;
    }
    connectionsByIp.set(key, count - 1);
  }

  function count(ip) {
    return connectionsByIp.get(normalizeIp(ip) || 'unknown') || 0;
  }

  function dispose() {
    connectionsByIp.clear();
  }

  return { connect, disconnect, count, dispose };
}

module.exports = { createIpLimiter, getClientIp, normalizeIp, DEFAULT_CONNECTION_LIMIT };
