import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Page } from '@playwright/test';

export interface AgentEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface PostedRun {
  readonly threadId?: string;
  readonly runId?: string;
  readonly messages: ReadonlyArray<{ role: string; content?: unknown; [key: string]: unknown }>;
  readonly [key: string]: unknown;
}

const AGENT_ROUTE = '**/api/agent/agui';
const sse = (event: AgentEvent) => `data: ${JSON.stringify(event)}\n\n`;
const HEADERS = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A recorded stream from e2e/fixtures, such as `journey-oncomatrix`. */
export const loadStream = (name: string): AgentEvent[] =>
  fs
    .readFileSync(path.join(__dirname, '..', 'fixtures', `${name}.sse`), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice('data: '.length)) as AgentEvent);

/** Stops a stream before the first event that matches, until `release` is called. */
export interface StreamGate {
  readonly before: (event: AgentEvent) => boolean;
  /** Resolves once the stream has stopped at the gate. */
  readonly reached: Promise<void>;
  readonly release: () => void;
  readonly arrive: () => Promise<void>;
}

export const streamGate = (before: StreamGate['before']): StreamGate => {
  let reach = () => {};
  let release = () => {};
  const reached = new Promise<void>((resolve) => { reach = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  return {
    before,
    reached,
    release,
    arrive: () => {
      reach();
      return released;
    },
  };
};

/**
 * Serves SSE for POST /api/agent/agui and records each posted RunAgentInput. `streams` is one
 * stream for every run, or a list with one per run, where the last one repeats.
 *
 * route.fulfill delivers its body in one piece, so with `delayMs` or `gate` the events are
 * instead written one at a time by a small local server that the intercepted request is
 * continued to. Without them the body is fulfilled at once.
 */
export const mockAgent = async (
  page: Page,
  streams: ReadonlyArray<AgentEvent> | ReadonlyArray<ReadonlyArray<AgentEvent>>,
  options: { delayMs?: number; gate?: StreamGate } = {},
): Promise<PostedRun[]> => {
  const posted: PostedRun[] = [];
  const delayMs = options.delayMs ?? 0;
  const perRun = (Array.isArray(streams[0]) ? streams : [streams]) as ReadonlyArray<ReadonlyArray<AgentEvent>>;
  const streamFor = (run: number) => perRun[Math.min(run, perRun.length - 1)];
  let server: http.Server | undefined;
  let serverUrl = '';

  if (delayMs > 0 || options.gate) {
    let gatePassed = false;
    server = http.createServer(async (req, res) => {
      req.resume();
      res.writeHead(200, { ...HEADERS, 'access-control-allow-origin': '*' });
      for (const event of streamFor(posted.length - 1)) {
        if (options.gate && !gatePassed && options.gate.before(event)) {
          gatePassed = true;
          await options.gate.arrive();
        }
        res.write(sse(event));
        if (delayMs > 0) await wait(delayMs);
      }
      res.end();
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    serverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    page.on('close', () => server?.close());
  }

  await page.route(AGENT_ROUTE, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fallback();
    posted.push(request.postDataJSON() as PostedRun);
    if (server) return route.continue({ url: serverUrl });
    const events = streamFor(posted.length - 1);
    return route.fulfill({ status: 200, headers: HEADERS, body: events.map(sse).join('') });
  });
  return posted;
};
