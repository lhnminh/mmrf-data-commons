import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startForwarders } from '../scripts/dev-forward.mjs';

const script = fileURLToPath(new URL('../scripts/dev-forward.mjs', import.meta.url));
const PASSWORD = 'pw-secret-9f3a';
const USERNAME = 'tester';
const expectedAuth = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`;

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); });

const request = (port, { method = 'GET', path: p = '/', headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

// Each test gets a fake upstream that records what it received.
const setup = async (t, handler) => {
  const seen = [];
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const record = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() };
      seen.push(record);
      if (handler) return handler(req, res, record);
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
  });
  const upstreamPort = await listen(upstream);
  const logs = [];
  const forwarders = await startForwarders({
    origin: `http://127.0.0.1:${upstreamPort}`,
    username: USERNAME,
    password: PASSWORD,
    port: 0,
    proteinPaintPort: 0,
    log: (line) => logs.push(line),
  });
  t.after(async () => {
    await forwarders.close();
    await close(upstream);
  });
  return { seen, logs, forwarders };
};

test('adds Basic auth', async (t) => {
  const { seen, forwarders } = await setup(t);
  await request(forwarders.port, { path: '/guppy/graphql' });
  assert.equal(seen[0].headers.authorization, expectedAuth);
});

test('replaces any incoming authorization', async (t) => {
  const { seen, forwarders } = await setup(t);
  await request(forwarders.port, { headers: { authorization: 'Bearer caller-token' } });
  assert.equal(seen[0].headers.authorization, expectedAuth);
  assert.ok(!JSON.stringify(seen[0].headers).includes('caller-token'));
});

test('drops incoming cookies', async (t) => {
  const { seen, forwarders } = await setup(t);
  await request(forwarders.port, { headers: { cookie: 'credentials_token=abc' } });
  assert.equal(seen[0].headers.cookie, undefined);
});

test('maps the ProteinPaint port', async (t) => {
  const { seen, forwarders } = await setup(t);
  await request(forwarders.proteinPaintPort, {
    method: 'POST',
    path: '/termdb/topMutatedGenes?x=1',
    body: '{}',
  });
  assert.equal(seen[0].url, '/protein-paint/termdb/topMutatedGenes?x=1');
  assert.equal(seen[0].headers.authorization, expectedAuth);
});

test('passes method, body and status through', async (t) => {
  const { seen, forwarders } = await setup(t, (req, res, record) => {
    res.writeHead(record.url === '/missing' ? 404 : 201, { 'content-type': 'text/plain' });
    res.end(`echo:${record.body}`);
  });
  const created = await request(forwarders.port, {
    method: 'POST',
    path: '/analysis/x',
    headers: { 'content-type': 'application/json' },
    body: '{"a":1}',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body, 'echo:{"a":1}');
  assert.equal(seen[0].method, 'POST');
  assert.equal(seen[0].body, '{"a":1}');
  const missing = await request(forwarders.port, { path: '/missing' });
  assert.equal(missing.status, 404);
});

test('streams the response', async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { forwarders } = await setup(t, async (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('first\n\n');
    await gate;
    res.end('last\n\n');
  });
  const firstChunk = await new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: forwarders.port, path: '/s' }, (res) => {
      res.once('data', (c) => resolve(c.toString()));
      res.resume();
    });
    req.on('error', reject);
  });
  // The upstream has not ended yet, so this chunk arrived mid-stream.
  assert.equal(firstChunk, 'first\n\n');
  release();
});

test('binds to loopback', async (t) => {
  const { forwarders } = await setup(t);
  assert.equal(forwarders.addresses.main, '127.0.0.1');
  assert.equal(forwarders.addresses.proteinPaint, '127.0.0.1');
});

const runCli = (accessFile, env = {}) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, SANDBOX_ACCESS_FILE: accessFile, ...env },
    });
    let output = '';
    child.stdout.on('data', (c) => (output += c));
    child.stderr.on('data', (c) => (output += c));
    child.on('exit', (code) => resolve({ code, output }));
  });

const tmpAccessFile = (t, contents) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-forward-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'access.json');
  fs.writeFileSync(file, JSON.stringify(contents));
  return file;
};

test('refuses a bad access file', async (t) => {
  const file = tmpAccessFile(t, { origin: 'https://example.invalid', password: PASSWORD });
  const { code, output } = await runCli(file);
  assert.notEqual(code, 0);
  assert.ok(!output.includes(PASSWORD));
  assert.ok(!output.includes('example.invalid'));
  const missing = await runCli(path.join(path.dirname(file), 'nope.json'));
  assert.notEqual(missing.code, 0);
});

test('never logs the password', async (t) => {
  const file = tmpAccessFile(t, { origin: 'http://127.0.0.1:9', username: USERNAME, password: PASSWORD });
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, SANDBOX_ACCESS_FILE: file, DEV_FORWARD_PORT: '0', DEV_FORWARD_PP_PORT: '0' },
  });
  let output = '';
  child.stdout.on('data', (c) => (output += c));
  child.stderr.on('data', (c) => (output += c));
  await new Promise((resolve) => {
    const check = () => (/listening/i.test(output) ? resolve() : setTimeout(check, 50));
    check();
  });
  // Provoke an upstream error path too (port 9 refuses connections).
  const port = Number(/main:(\d+)/.exec(output)?.[1]);
  if (port) await request(port, { path: '/x' });
  child.kill();
  await new Promise((resolve) => child.on('exit', resolve));
  assert.ok(output.length > 0);
  assert.ok(!output.includes(PASSWORD));
  assert.ok(!output.includes(Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')));
});

test('rejects a Host that is not this loopback listener', async (t) => {
  const { seen, forwarders } = await setup(t);
  for (const host of ['evil.example', 'rebind.example:' + forwarders.port, '127.0.0.1:1', 'localhost']) {
    const res = await request(forwarders.port, { headers: { host } });
    assert.equal(res.status, 403, host);
  }
  assert.equal(seen.length, 0);
  assert.equal((await request(forwarders.port, { headers: { host: `localhost:${forwarders.port}` } })).status, 200);
  assert.equal((await request(forwarders.proteinPaintPort)).status, 200);
  assert.equal(
    (await request(forwarders.proteinPaintPort, { headers: { host: `localhost:${forwarders.port}` } })).status,
    403,
  );
});
