import { type AgentToolCall, toMessageContent } from './agentResponse';

const ok = (name: string): AgentToolCall => ({
  name,
  input: { primaryVariable: 'A', secondaryVariable: 'B' },
  status: 'success',
  result: { summary: 'S', plot: { type: 'survival' } },
});

describe('toMessageContent', () => {
  it('puts tool parts before text, in response order', () => {
    const content = toMessageContent({
      message: 'M',
      toolCalls: [ok('first'), ok('second')],
    });
    expect(content.map((part) => part.type)).toEqual([
      'tool-call',
      'tool-call',
      'text',
    ]);
    expect(content[0]).toMatchObject({
      toolName: 'first',
      toolCallId: 'first-0',
      args: ok('first').input,
    });
    expect(content[1]).toMatchObject({
      toolName: 'second',
      toolCallId: 'second-1',
    });
    expect(content[2]).toEqual({ type: 'text', text: 'M' });
  });

  it('marks a failed call as an error with its message', () => {
    const [part] = toMessageContent({
      message: '',
      toolCalls: [{ name: 't', input: {}, status: 'error', error: 'boom' }],
    });
    expect(part).toMatchObject({
      type: 'tool-call',
      isError: true,
      result: { error: 'boom' },
    });
  });

  it('treats a started call as failed', () => {
    const [part] = toMessageContent({
      message: '',
      toolCalls: [{ name: 't', input: {}, status: 'started' }],
    });
    expect(part).toMatchObject({
      isError: true,
      result: { error: 'The tool did not finish.' },
    });
  });

  it('produces no text part for an empty message', () => {
    expect(toMessageContent({ message: '', toolCalls: [] })).toEqual([]);
  });
});
