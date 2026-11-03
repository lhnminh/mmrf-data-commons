import { createHash } from 'node:crypto';
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const INTERRUPTED =
  'data: {"type":"RUN_ERROR","code":"STREAM_INTERRUPTED","message":"The agent stream was interrupted."}\n\n';

export interface InvokeArgs {
  agentRuntimeArn: string;
  runtimeSessionId: string;
  payload: string;
  abortSignal: AbortSignal;
}

export interface ProxyDeps {
  nodeEnv: string | undefined;
  runtimeArn: string | undefined;
  invoke(args: InvokeArgs): Promise<AsyncIterable<Uint8Array>>;
  log(message: string, error?: unknown): void;
}

/** One thread stays on one Runtime session, and the hash is always long enough for one. */
export const runtimeSessionId = (threadId: string): string =>
  createHash('sha256').update(threadId).digest('hex');

export const regionFromRuntimeArn = (arn: string): string => arn.split(':')[3];

const readBody = async (req: NextApiRequest): Promise<string> => {
  const parts: Buffer[] = [];
  for await (const part of req) parts.push(Buffer.from(part));
  return Buffer.concat(parts).toString('utf8');
};

const threadIdOf = (body: string): string | undefined => {
  try {
    const threadId = (JSON.parse(body) as { threadId?: unknown } | null)?.threadId;
    return typeof threadId === 'string' && threadId ? threadId : undefined;
  } catch {
    return undefined;
  }
};

const fail = (res: NextApiResponse, status: number, error: string) => {
  res.status(status).json({ error });
};

/**
 * Lets the local Chat page reach the deployed agent. It signs with the developer's
 * AWS credentials, so it answers only in development and only to this machine.
 */
export const createAgentProxyHandler =
  ({ nodeEnv, runtimeArn, invoke, log }: ProxyDeps): NextApiHandler =>
  async (req, res) => {
    if (nodeEnv !== 'development') return fail(res, 404, 'Not found');
    if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) return fail(res, 403, 'Forbidden');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return fail(res, 405, 'Method not allowed');
    }
    if (!/^application\/json(;|$)/i.test(req.headers['content-type'] ?? '')) {
      return fail(res, 415, 'Content-Type must be application/json');
    }
    const payload = await readBody(req);
    const threadId = threadIdOf(payload);
    if (!threadId) return fail(res, 400, 'A threadId is required');
    if (!runtimeArn) {
      log('Set AGENTCORE_RUNTIME_ARN in .env.development.local and restart.');
      return fail(res, 502, 'The agent is unavailable');
    }

    const upstream = new AbortController();
    res.on('close', () => upstream.abort());

    let stream: AsyncIterable<Uint8Array>;
    try {
      stream = await invoke({
        agentRuntimeArn: runtimeArn,
        runtimeSessionId: runtimeSessionId(threadId),
        payload,
        abortSignal: upstream.signal,
      });
    } catch (error) {
      log('InvokeAgentRuntime failed. Check AWS_PROFILE and refresh expired credentials.', error);
      return fail(res, 502, 'The agent is unavailable');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();
    const flush = () => (res as NextApiResponse & { flush?: () => void }).flush?.();

    try {
      for await (const chunk of stream) {
        if (upstream.signal.aborted) break;
        res.write(chunk);
        flush();
      }
    } catch (error) {
      if (!upstream.signal.aborted) {
        log('The agent stream failed after it started.', error);
        res.write(INTERRUPTED);
      }
    }
    res.end();
  };
