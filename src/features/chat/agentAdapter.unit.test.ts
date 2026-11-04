import { agentAdapter, createAgentAdapter } from './agentAdapter';

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
        context: { cohortFilter: null },
        history: [
          { role: 'user', content: 'What is a cohort?' },
          { role: 'assistant', content: 'A selected set.' },
        ],
      }),
    }));
  });

  it('passes the active cohort and returns tool plots for Chat', async () => {
    const cohortFilter = { in: { 'demographic.race': ['black or african american'] } };
    const plot = { type: 'top_mutated_genes', genes: [{ gene: 'KRAS', count: 148 }] };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'KRAS is first.', toolCalls: [{
        name: 'top_mutated_genes', input: { race: 'Black or African American' },
        status: 'success', result: { summary: 'Result', plot },
      }] }),
    } as Response);
    const adapter = createAgentAdapter(() => cohortFilter);
    const result = await adapter.run({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Top mutated genes?' }] }],
      abortSignal: new AbortController().signal,
    } as unknown as Parameters<typeof adapter.run>[0]);
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string).context).toEqual({ cohortFilter });
    expect(result.content[1]).toEqual(expect.objectContaining({
      type: 'tool-call', toolName: 'top_mutated_genes', result: { summary: 'Result', plot },
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
