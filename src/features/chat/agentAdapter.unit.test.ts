import { agentAdapter } from './agentAdapter';

describe('agentAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the current question and prior conversation to the sandbox agent', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'A cohort is a set of cases.' }),
    } as Response);
    const abortSignal = new AbortController().signal;
    const result = await agentAdapter.run({
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'What is a cohort?' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'A selected set.' }] },
        { role: 'user', content: [{ type: 'text', text: 'Can you explain more?' }] },
      ], abortSignal,
    } as unknown as Parameters<typeof agentAdapter.run>[0]);
    expect(result.content).toEqual([{ type: 'text', text: 'A cohort is a set of cases.' }]);
    expect(fetchSpy).toHaveBeenCalledWith('/agent/v1/prompts', expect.objectContaining({
      method: 'POST', signal: abortSignal,
      body: JSON.stringify({
        prompt: 'Can you explain more?',
        history: [
          { role: 'user', content: 'What is a cohort?' },
          { role: 'assistant', content: 'A selected set.' },
        ],
      }),
    }));
  });

  it('shows a connection error when the agent is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response);
    const result = await agentAdapter.run({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      abortSignal: new AbortController().signal,
    } as unknown as Parameters<typeof agentAdapter.run>[0]);
    expect(result.content[0]).toEqual({
      type: 'text', text: 'The research agent is unavailable. Please try again.',
    });
  });
});
