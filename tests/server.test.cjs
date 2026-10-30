const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { startServer } = require('../server.cjs');

async function testServer(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moneymaxing-test-'));
  const instance = await startServer({ appDir: path.join(__dirname, '..'), dataDir, host: '127.0.0.1', port: 0 });
  t.after(async () => {
    await instance.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  return instance.origin;
}

function encryptedVault(marker = 'ciphertext') {
  return {
    version: 1,
    iterations: 310000,
    salt: Buffer.alloc(16, 1).toString('base64'),
    iv: Buffer.alloc(12, 2).toString('base64'),
    ciphertext: Buffer.from(marker.padEnd(20, 'x')).toString('base64')
  };
}

test('serves the app over HTTP and does not expose API responses cross-origin', async t => {
  const origin = await testServer(t);
  const page = await fetch(`${origin}/`);
  const html = await page.text();
  const health = await fetch(`${origin}/api/health`);

  assert.equal(page.status, 200);
  assert.match(html, /MONEYMAXING — Finanzas personales/);
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal(health.headers.get('access-control-allow-origin'), null);
});

test('stores one encrypted vault and rejects stale updates instead of overwriting newer data', async t => {
  const origin = await testServer(t);
  const initial = await fetch(`${origin}/api/vault`).then(r => r.json());
  assert.deepEqual(initial, { revision: 0, vault: null });

  const created = await fetch(`${origin}/api/vault`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(encryptedVault())
  });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { revision: 1, vault: encryptedVault() });

  const duplicate = await fetch(`${origin}/api/vault`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(encryptedVault('replacement'))
  });
  assert.equal(duplicate.status, 409);

  const updated = await fetch(`${origin}/api/vault`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'if-match': '1' },
    body: JSON.stringify(encryptedVault('updated'))
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).revision, 2);

  const stale = await fetch(`${origin}/api/vault`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'if-match': '1' },
    body: JSON.stringify(encryptedVault('stale'))
  });
  assert.equal(stale.status, 409);
  assert.deepEqual(await fetch(`${origin}/api/vault`).then(r => r.json()), {
    revision: 2,
    vault: encryptedVault('updated')
  });
});

test('serializes simultaneous writes from two devices', async t => {
  const origin = await testServer(t);
  await fetch(`${origin}/api/vault`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(encryptedVault())
  });
  const save = marker => fetch(`${origin}/api/vault`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'if-match': '1' },
    body: JSON.stringify(encryptedVault(marker))
  });
  const responses = await Promise.all([save('device-a'), save('device-b')]);

  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await fetch(`${origin}/api/vault`).then(r => r.json())).revision, 2);
});

test('rejects invalid encrypted vault records', async t => {
  const origin = await testServer(t);
  const response = await fetch(`${origin}/api/vault`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: 1, salt: 'bad', ciphertext: 'bad' })
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_vault');
});
