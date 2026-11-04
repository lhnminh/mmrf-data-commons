import http from 'node:http';
import type { AddressInfo } from 'node:net';
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

/**
 * Serves `events` as SSE for POST /api/agent/agui and records each posted RunAgentInput.
 *
 * route.fulfill delivers its body in one piece, so with `delayMs` the events are instead
 * written one at a time, `delayMs` apart, by a small local server that the intercepted
 * request is continued to. Without `delayMs` the body is fulfilled at once.
 */
export const mockAgent = async (
  page: Page,
  events: ReadonlyArray<AgentEvent>,
  options: { delayMs?: number } = {},
): Promise<PostedRun[]> => {
  const posted: PostedRun[] = [];
  const delayMs = options.delayMs ?? 0;
  let server: http.Server | undefined;
  let serverUrl = '';

  if (delayMs > 0) {
    server = http.createServer(async (req, res) => {
      req.resume();
      res.writeHead(200, { ...HEADERS, 'access-control-allow-origin': '*' });
      for (const event of events) {
        res.write(sse(event));
        await wait(delayMs);
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
    return route.fulfill({ status: 200, headers: HEADERS, body: events.map(sse).join('') });
  });
  return posted;
};
