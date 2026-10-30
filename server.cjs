const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB para soportar carteras extensas y perfiles múltiples
const MIN_PBKDF2_ITERATIONS = 100000;
const MAX_PBKDF2_ITERATIONS = 1000000;

function isBase64(value) {
  return typeof value === 'string' && value.length > 0 &&
    value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function isValidVault(vault) {
  if (!vault || typeof vault !== 'object' || Array.isArray(vault)) return false;
  if (vault.version !== 1 || !Number.isInteger(vault.iterations) ||
      vault.iterations < MIN_PBKDF2_ITERATIONS || vault.iterations > MAX_PBKDF2_ITERATIONS) return false;
  if (!isBase64(vault.salt) || !isBase64(vault.iv) || !isBase64(vault.ciphertext)) return false;
  return Buffer.from(vault.salt, 'base64').length === 16 &&
    Buffer.from(vault.iv, 'base64').length === 12 &&
    Buffer.from(vault.ciphertext, 'base64').length >= 16;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  response.end(body);
}

async function readJsonBody(request) {
  if (!String(request.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    const error = new Error('Expected application/json');
    error.status = 415;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Malformed JSON');
    error.status = 400;
    throw error;
  }
}

async function readVault(file) {
  try {
    const document = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Number.isInteger(document.revision) || document.revision < 1 || !isValidVault(document.vault)) {
      throw new Error('Stored vault failed validation');
    }
    return document;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeVault(file, document) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(document), { mode: 0o600 });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

function createServer({ appDir = __dirname, vaultFile }) {
  if (!vaultFile) throw new TypeError('vaultFile is required');
  let writeQueue = Promise.resolve();
  function serializeWrite(operation) {
    const next = writeQueue.then(operation, operation);
    writeQueue = next.catch(() => {});
    return next;
  }

  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    try {
      if (request.method === 'GET' && pathname === '/api/health') {
        sendJson(response, 200, { ok: true });
        return;
      }
      if (request.method === 'GET' && pathname === '/api/vault') {
        const document = await readVault(vaultFile);
        sendJson(response, 200, document || { revision: 0, vault: null });
        return;
      }
      if ((request.method === 'POST' || request.method === 'PUT') && pathname === '/api/vault') {
        const vault = await readJsonBody(request);
        if (!isValidVault(vault)) {
          sendJson(response, 400, { error: 'invalid_vault' });
          return;
        }
        const result = await serializeWrite(async () => {
          const current = await readVault(vaultFile);
          if (request.method === 'POST') {
            if (current) return { status: 409, body: { error: 'vault_exists', revision: current.revision } };
            const created = { revision: 1, vault };
            await writeVault(vaultFile, created);
            return { status: 201, body: created };
          }
          if (!current) return { status: 404, body: { error: 'vault_not_found' } };
          if (request.headers['if-match'] !== String(current.revision)) {
            return { status: 409, body: { error: 'vault_conflict', revision: current.revision } };
          }
          const updated = { revision: current.revision + 1, vault };
          await writeVault(vaultFile, updated);
          return { status: 200, body: updated };
        });
        sendJson(response, result.status, result.body);
        return;
      }
      if (request.method === 'GET' && (pathname === '/' || pathname === '/MONEYMAXING.html')) {
        const html = await fs.readFile(path.join(appDir, 'MONEYMAXING.html'));
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-length': html.length,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff'
        });
        response.end(html);
        return;
      }
      sendJson(response, 404, { error: 'not_found' });
    } catch (error) {
      if (!response.headersSent) {
        sendJson(response, error.status || 500, { error: error.status ? 'bad_request' : 'server_error' });
      } else {
        response.destroy();
      }
    }
  });
}

async function startServer({ appDir = __dirname, dataDir, host = '127.0.0.1', port = 4765 }) {
  if (!dataDir) throw new TypeError('dataDir is required');
  const server = createServer({ appDir, vaultFile: path.join(dataDir, 'vault.enc.json') });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address();
  return {
    server,
    origin: `http://${host}:${address.port}`,
    port: address.port,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}

module.exports = { createServer, startServer, isValidVault };
