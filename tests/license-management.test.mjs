import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { licenseManagementRouter } from '../.server-tests/license-management.js';

const key = 'test-only-admin-key-at-least-32-characters';
const origin = 'http://portfolio.test';
async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
async function fixture(t) {
  const upstream = express(); upstream.use(express.json());
  let license = { id: 'license-1', clinicName: 'کلینیک آزمون', installationId: 'install-1', productId: 'dental-clinic', environment: 'Production', isActive: true, expiresAt: '2027-01-01T00:00:00Z', lastSeenAt: null, revision: 1 };
  const credentials = () => ({ license, installationSecret: 'new-installation-secret-shown-once-only' });
  let csrfRequests = 0;
  upstream.get('/admin/csrf', (_req, res) => { csrfRequests++; res.cookie('central-csrf', 'antiforgery-cookie'); res.json({ token: 'antiforgery-token' }); });
  upstream.use('/admin', (req, res, next) => {
    if (req.method !== 'GET' && (!req.headers.cookie?.includes('central-csrf=antiforgery-cookie') || req.get('X-CSRF-TOKEN') !== 'antiforgery-token')) return res.sendStatus(400);
    next();
  });
  upstream.post('/admin/login', (req, res) => {
    if (req.body.key !== key) return res.sendStatus(401);
    res.cookie('central-auth', 'upstream-cookie-never-in-browser'); return res.sendStatus(204);
  });
  upstream.use('/admin', (req, res, next) => {
    if (!req.headers.cookie?.includes('central-auth=upstream-cookie-never-in-browser')) return res.sendStatus(401);
    next();
  });
  upstream.post('/admin/logout', (_req, res) => res.sendStatus(503));
  upstream.get('/admin/licenses', (_req, res) => res.json([license]));
  upstream.post('/admin/licenses', (req, res) => { license = { ...license, ...req.body }; res.json(credentials()); });
  upstream.put('/admin/licenses/:id', (req, res) => {
    if (req.body.revision !== license.revision) return res.status(409).json({ error: 'conflict' });
    license = { ...license, ...req.body, revision: license.revision + 1 }; return res.json(license);
  });
  upstream.post('/admin/licenses/:id/rotate-secret', (_req, res) => res.json(credentials()));
  upstream.get('/admin/signing-key', (_req, res) => res.json({ keyId: 'test-key', publicKey: 'public-key-only' }));
  const central = await listen(upstream); t.after(central.close);
  const app = express(); app.use('/api/license-management', licenseManagementRouter({ serverUrl: central.url, origin, production: false }));
  const gateway = await listen(app); t.after(gateway.close);
  let cookie = '';
  async function request(path, method = 'GET', body, headers = {}) {
    const result = await fetch(`${gateway.url}/api/license-management${path}`, {
      method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method === 'GET' ? {} : { Origin: origin, 'X-License-Management': '1', 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return result;
  }
  async function login() {
    const result = await request('/login', 'POST', { key }); assert.equal(result.status, 200);
    const value = result.headers.get('set-cookie');
    assert.match(value, /HttpOnly/i); assert.match(value, /SameSite=Strict/i);
    assert.doesNotMatch(value, /central-auth|central-csrf|upstream-cookie|antiforgery/);
    cookie = result.headers.getSetCookie().find(x => x.startsWith('portfolio_license_admin=')).split(';')[0];
    assert.equal(csrfRequests, 2);
  }
  return { request, login };
}

test('private data and changes require a valid admin session', async t => {
  const { request } = await fixture(t);
  for (const [path, method, body] of [['/licenses', 'GET'], ['/signing-key', 'GET'], ['/licenses', 'POST', {}], ['/licenses/license-1', 'PUT', {}], ['/licenses/license-1/rotate-secret', 'POST']]) {
    const response = await request(path, method, body); assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /installationSecret|کلینیک آزمون/);
  }
});
test('login checks central credentials, retains upstream CSRF/cookies, and returns a private session cookie', async t => {
  const { request, login } = await fixture(t);
  assert.equal((await request('/login', 'POST', { key: 'wrong-but-at-least-thirty-two-characters' })).status, 401);
  // New fixture ensures one successful login makes exactly two CSRF requests.
  const next = await fixture(t); await next.login();
  const session = await (await next.request('/session')).json(); assert.equal(session.authenticated, true);
  const licenses = await next.request('/licenses'); assert.equal(licenses.status, 200);
  assert.equal((await licenses.json())[0].clinicName, 'کلینیک آزمون');
});
test('cross-origin and missing custom headers cannot log in or mutate licenses', async t => {
  const { request, login } = await fixture(t); await login();
  assert.equal((await request('/licenses', 'POST', {}, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request('/licenses', 'POST', {}, { 'X-License-Management': '' })).status, 403);
  assert.equal((await request('/logout', 'POST', {}, { Origin: '' })).status, 403);
  assert.equal((await request('/licenses')).status, 200);
});
test('creation, expiry/status updates, revision conflicts, rotation and public key use the same central records', async t => {
  const { request, login } = await fixture(t); await login();
  const created = await (await request('/licenses', 'POST', { clinicName: 'کلینیک جدید', expiresAt: '2027-02-01T00:00:00Z' })).json();
  assert.equal(created.license.clinicName, 'کلینیک جدید'); assert.ok(created.installationSecret);
  const updated = await request('/licenses/license-1', 'PUT', { isActive: false, expiresAt: '2027-03-01T00:00:00Z', revision: 1 });
  assert.equal(updated.status, 200); assert.equal((await updated.json()).isActive, false);
  assert.equal((await request('/licenses/license-1', 'PUT', { revision: 1 })).status, 409);
  assert.ok((await (await request('/licenses/license-1/rotate-secret', 'POST')).json()).installationSecret);
  assert.equal((await (await request('/signing-key')).json()).keyId, 'test-key');
  assert.equal((await (await request('/licenses')).json())[0].isActive, false);
});
test('logout clears local access even when the central logout endpoint is unavailable', async t => {
  const { request, login } = await fixture(t); await login();
  assert.equal((await request('/logout', 'POST')).status, 204);
  assert.equal((await (await request('/session')).json()).authenticated, false);
  assert.equal((await request('/licenses')).status, 401);
});
test('repeated failed logins are limited', async t => {
  const { request } = await fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await request('/login', 'POST', { key: 'invalid' })).status, 400);
  assert.equal((await request('/login', 'POST', { key })).status, 429);
});
test('missing configuration and insecure production URLs fail closed without breaking the portfolio', async t => {
  for (const config of [{ serverUrl: '' }, { serverUrl: 'http://127.0.0.1:5090', production: true, origin: 'https://portfolio.example' }, { serverUrl: 'https://license.example', production: true }]) {
    const app = express(); app.use('/api/license-management', licenseManagementRouter(config));
    const server = await listen(app); t.after(server.close);
    const result = await fetch(server.url + '/api/license-management/session'); assert.equal(result.status, 200);
    assert.equal((await result.json()).configured, false);
    assert.equal((await fetch(server.url + '/api/license-management/licenses')).status, 503);
  }
});
