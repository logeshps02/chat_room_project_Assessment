const request = require('supertest');
const { createApp } = require('../../src/app');

describe('HTTP app', () => {
  const app = createApp();

  test('GET /health returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  test('GET / serves the HTML page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('ChatRooms');
  });

  test('unknown page returns 404', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
  });

  test('unknown /api route returns JSON 404', async () => {
    const res = await request(app).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  test('does not expose the X-Powered-By header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
