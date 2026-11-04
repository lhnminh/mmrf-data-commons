/** @jest-environment node */
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createAgentProxyHandler,
  regionFromRuntimeArn,
  runtimeSessionId,
  type InvokeArgs,
  type ProxyDeps,
} from './proxy';

const ARN = 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/agent-abc';
const BODY = JSON.stringify({ threadId: 't', runId: 'r', messages: [] });

interface FakeResponse extends EventEmitter {
  statusCode: number;
  headers: Record<string, string>;
  chunks: string[];
  ended: boolean;
  flush: jest.Mock;
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  status(code: number): FakeResponse;
  json(value: unknown): FakeResponse;
  write(chunk: Uint8Array | string): boolean;
  end(chunk?: string): void;
}

const fakeResponse = (): FakeResponse => {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    headers: {} as Record<string, string>,
    chunks: [] as string[],
    ended: false,
    flush: jest.fn(),
    setHeader(name: string, value: string) { res.headers[name.toLowerCase()] = value; },
    flushHeaders() {},
    status(code: number) { res.statusCode = code; return res; },
    json(value: unknown) { res.chunks.push(JSON.stringify(value)); res.ended = true; return res; },
    write(chunk: Uint8Array | string) { res.chunks.push(Buffer.from(chunk).toString()); return true; },
    end(chunk?: string) { if (chunk) res.chunks.push(chunk); res.ended = true; },
  }) as FakeResponse;
  return res;
};

const fakeRequest = ({
  method = 'POST',
  contentType = 'application/json',
  remoteAddress = '127.0.0.1',
  body = BODY,
} = {}) =>
  Object.assign(Readable.from([Buffer.from(body)]), {
    method,
    headers: { 'content-type': contentType },
    socket: { remoteAddress },
  }) as unknown as NextApiRequest;

const chunks = async function* (...parts: string[]) {
  for (const part of parts) yield new TextEncoder().encode(part);
};

const setup = (overrides: Partial<ProxyDeps> = {}) => {
  const invoke = jest.fn<Promise<AsyncIterable<Uint8Array>>, [InvokeArgs]>(async () => chunks('a'));
  const log = jest.fn();
  const handler = createAgentProxyHandler({
    nodeEnv: 'development',
    runtimeArn: ARN,
    invoke,
    log,
    ...overrides,
  });
  return { handler, invoke: (overrides.invoke ?? invoke) as jest.Mock, log };
};

const run = async (handler: ReturnType<typeof createAgentProxyHandler>, req = fakeRequest()) => {
  const res = fakeResponse();
  await handler(req, res as unknown as NextApiResponse);
  return res;
};

describe('runtimeSessionId', () => {
  it('keeps one session per thread', () => {
    expect(runtimeSessionId('t')).toBe(runtimeSessionId('t'));
    expect(runtimeSessionId('t')).not.toBe(runtimeSessionId('u'));
    expect(runtimeSessionId('t')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('regionFromRuntimeArn', () => {
  it('reads the region field', () => {
    expect(regionFromRuntimeArn(ARN)).toBe('us-west-2');
  });
});

describe('createAgentProxyHandler', () => {
  it('returns 404 outside development', async () => {
    const { handler, invoke } = setup({ nodeEnv: 'production' });
    expect((await run(handler)).statusCode).toBe(404);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('rejects a non-loopback caller', async () => {
    const { handler, invoke } = setup();
    const res = await run(handler, fakeRequest({ remoteAddress: '192.168.1.20' }));
    expect(res.statusCode).toBe(403);
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('accepts loopback caller %s', async (remoteAddress) => {
    const { handler, invoke } = setup();
    await run(handler, fakeRequest({ remoteAddress }));
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('rejects other methods', async () => {
    const { handler, invoke } = setup();
    expect((await run(handler, fakeRequest({ method: 'GET' }))).statusCode).toBe(405);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('rejects media types that a cross-site form could send', async () => {
    const { handler, invoke } = setup();
    expect((await run(handler, fakeRequest({ contentType: 'text/plain' }))).statusCode).toBe(415);
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each(['not json', '{}', '{"threadId":7}', '{"threadId":""}', 'null'])(
    'rejects body with no usable threadId: %s',
    async (body) => {
      const { handler, invoke } = setup();
      expect((await run(handler, fakeRequest({ body }))).statusCode).toBe(400);
      expect(invoke).not.toHaveBeenCalled();
    },
  );

  it('explains a missing ARN in the log only', async () => {
    const { handler, invoke, log } = setup({ runtimeArn: undefined });
    const res = await run(handler);
    expect(res.statusCode).toBe(502);
    expect(invoke).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain('AGENTCORE_RUNTIME_ARN');
    expect(res.chunks.join('')).not.toContain('AGENTCORE_RUNTIME_ARN');
  });

  it('passes the body and chunks through unchanged', async () => {
    const invoke = jest.fn(async () => chunks('data: one\n\n', 'data: two\n\n'));
    const { handler } = setup({ invoke });
    const res = await run(handler);
    expect(invoke.mock.calls[0]).toEqual([
      expect.objectContaining({
        agentRuntimeArn: ARN,
        runtimeSessionId: runtimeSessionId('t'),
        payload: BODY,
      }),
    ]);
    expect(res.chunks).toEqual(['data: one\n\n', 'data: two\n\n']);
    expect(res.ended).toBe(true);
  });

  it('flushes each chunk', async () => {
    const { handler } = setup({ invoke: jest.fn(async () => chunks('1', '2')) });
    expect((await run(handler)).flush).toHaveBeenCalledTimes(2);
  });

  it('sets streaming headers', async () => {
    const { handler } = setup();
    const { headers } = await run(handler);
    expect(headers['content-type']).toBe('text/event-stream');
    expect(headers['cache-control']).toBe('no-cache, no-transform');
  });

  it('hides errors before the stream starts', async () => {
    const error = new Error('secret detail');
    const { handler, log } = setup({ invoke: jest.fn().mockRejectedValue(error) });
    const res = await run(handler);
    expect(res.statusCode).toBe(502);
    expect(res.chunks.join('')).not.toContain('secret detail');
    expect(log).toHaveBeenCalledWith(expect.any(String), error);
  });

  it('reports a failure after the stream starts', async () => {
    const broken = async function* () {
      yield new TextEncoder().encode('data: one\n\n');
      throw new Error('secret detail');
    };
    const { handler } = setup({ invoke: jest.fn(async () => broken()) });
    const res = await run(handler);
    expect(res.chunks.at(-1)).toBe(
      'data: {"type":"RUN_ERROR","code":"STREAM_INTERRUPTED","message":"The agent stream was interrupted."}\n\n',
    );
    expect(res.chunks.join('')).not.toContain('secret detail');
    expect(res.ended).toBe(true);
  });

  it('aborts upstream on disconnect', async () => {
    let signal: AbortSignal | undefined;
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const slow = async function* () {
      yield new TextEncoder().encode('first');
      await gate;
      yield new TextEncoder().encode('late');
    };
    const { handler } = setup({
      invoke: jest.fn(async (args: InvokeArgs) => { signal = args.abortSignal; return slow(); }),
    });
    const res = fakeResponse();
    const done = handler(fakeRequest(), res as unknown as NextApiResponse);
    await new Promise((resolve) => setTimeout(resolve, 10));
    res.emit('close');
    expect(signal?.aborted).toBe(true);
    release();
    await done;
    expect(res.chunks).toEqual(['first']);
  });
});
