/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpAgent } from '@ag-ui/client';

const STREAM = readFileSync(join(__dirname, '__fixtures__/agui-sample-stream.sse'));

interface WireEvent {
  readonly type: string;
  readonly toolCallId?: string;
  readonly delta?: string;
}

const readStream = async (): Promise<WireEvent[]> => {
  global.fetch = jest.fn().mockResolvedValue(
    new Response(STREAM, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  );
  const agent = new HttpAgent({ url: '/api/agent/agui' });
  const events: WireEvent[] = [];
  await new Promise<void>((resolve, reject) => {
    agent
      .run({ threadId: 't', runId: 'r', messages: [], tools: [], context: [], state: {}, forwardedProps: {} })
      .subscribe({ next: (event) => events.push(event as WireEvent), error: reject, complete: resolve });
  });
  return events;
};

describe('a real stream recorded from the deployed agent', () => {
  it('parses with the official client and ends the run', async () => {
    const types = (await readStream()).map((event) => event.type);
    expect(types[0]).toBe('RUN_STARTED');
    expect(types.at(-1)).toBe('RUN_FINISHED');
    expect(types).not.toContain('RUN_ERROR');
  });

  it('gives every tool call a start, end and result', async () => {
    const events = await readStream();
    const started = events.filter((event) => event.type === 'TOOL_CALL_START');
    expect(started.length).toBeGreaterThan(0);
    started.forEach(({ toolCallId }) => {
      ['TOOL_CALL_END', 'TOOL_CALL_RESULT'].forEach((type) =>
        expect(events.some((event) => event.type === type && event.toolCallId === toolCallId)).toBe(true),
      );
    });
  });

  it('reports the live case count in the answer', async () => {
    const answer = (await readStream())
      .filter((event) => event.type === 'TEXT_MESSAGE_CONTENT')
      .map((event) => event.delta)
      .join('');
    expect(answer).toMatch(/1,?000/);
  });
});
