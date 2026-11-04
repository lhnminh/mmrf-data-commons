#!/usr/bin/env node
// Local forwarders to a deployed Virtual Lab, so `next dev` can use its data.
//   :3090 -> <origin>                  (NEXT_PUBLIC_GEN3_API_TARGET)
//   :3091 -> <origin>/protein-paint    (PROTEINPAINT_API)
// Both add HTTP Basic auth, drop incoming cookies, and listen on 127.0.0.1 only.
// Reads SANDBOX_ACCESS_FILE (JSON: origin, username, password). Never prints the contents.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer'];

const listen = (server, port) =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server.address()));
  });

const makeServer = (target, authorization, log) => {
  const base = new URL(target);
  const client = base.protocol === 'https:' ? https : http;
  const basePath = base.pathname.replace(/\/$/, '');
  return http.createServer((req, res) => {
    const headers = { ...req.headers, authorization, host: base.host };
    delete headers.cookie;
    HOP_BY_HOP.forEach((h) => delete headers[h]);
    const upstream = client.request(
      { protocol: base.protocol, hostname: base.hostname, port: base.port || undefined, method: req.method, path: basePath + req.url, headers },
      (upRes) => {
        const out = { ...upRes.headers };
        HOP_BY_HOP.forEach((h) => delete out[h]);
        res.writeHead(upRes.statusCode ?? 502, out);
        upRes.pipe(res);
      },
    );
    upstream.on('error', (error) => {
      log(`upstream error for ${req.method} ${req.url}: ${error.code ?? 'failed'}`);
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'The forwarding target is unreachable' }));
    });
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  });
};

export const startForwarders = async ({
  origin,
  username,
  password,
  port = 3090,
  proteinPaintPort = 3091,
  log = console.log,
}) => {
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const root = origin.replace(/\/$/, '');
  const main = makeServer(root, authorization, log);
  const proteinPaint = makeServer(`${root}/protein-paint`, authorization, log);
  const mainAddress = await listen(main, port);
  const ppAddress = await listen(proteinPaint, proteinPaintPort);
  return {
    port: mainAddress.port,
    proteinPaintPort: ppAddress.port,
    addresses: { main: mainAddress.address, proteinPaint: ppAddress.address },
    close: () =>
      Promise.all(
        [main, proteinPaint].map(
          (s) => new Promise((resolve) => { s.closeAllConnections?.(); s.close(resolve); }),
        ),
      ),
  };
};

// Errors here never include the file's contents or the origin.
const readAccessFile = (file) => {
  if (!file) throw new Error('SANDBOX_ACCESS_FILE is not set');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error('SANDBOX_ACCESS_FILE could not be read as JSON');
  }
  const missing = ['origin', 'username', 'password'].filter(
    (k) => typeof parsed?.[k] !== 'string' || parsed[k] === '',
  );
  if (missing.length) throw new Error(`Access file is missing: ${missing.join(', ')}`);
  try {
    new URL(parsed.origin);
  } catch {
    throw new Error('Access file origin is not a valid URL');
  }
  return parsed;
};

const main = async () => {
  let access;
  try {
    access = readAccessFile(process.env.SANDBOX_ACCESS_FILE);
  } catch (error) {
    console.error(`dev-forward: ${error.message}`);
    process.exit(1);
  }
  const forwarders = await startForwarders({
    ...access,
    port: Number(process.env.DEV_FORWARD_PORT ?? 3090),
    proteinPaintPort: Number(process.env.DEV_FORWARD_PP_PORT ?? 3091),
  });
  console.log(`dev-forward listening on 127.0.0.1 main:${forwarders.port} proteinPaint:${forwarders.proteinPaintPort}`);
  const stop = () => forwarders.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`dev-forward: ${error.code ?? 'failed to start'}`);
    process.exit(1);
  });
}
