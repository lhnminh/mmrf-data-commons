import { createAgentAdapter } from './agentAdapter';

const agentAdapter = createAgentAdapter(() => undefined);

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
    expect(result.status).toEqual({ type: 'complete', reason: 'stop' });
  });

  describe('selected cohort', () => {
    const filter = { in: { 'demographic.gender': ['female'] } };
    const sentBody = (spy: jest.SpyInstance) =>
      JSON.parse(spy.mock.calls[0][1].body);
    const run = (adapter: ReturnType<typeof createAgentAdapter>) =>
      adapter.run({
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
        abortSignal: new AbortController().signal,
      } as unknown as Parameters<typeof agentAdapter.run>[0]);
    const respond = () =>
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'OK' }),
      } as Response);

    it('sends the selected cohort as context', async () => {
      const spy = respond();
      await run(createAgentAdapter(() => filter));
      expect(sentBody(spy).context).toEqual({ cohortFilter: filter });
    });

    it('sends no context when no filters are selected', async () => {
      const spy = respond();
      await run(createAgentAdapter(() => undefined));
      expect(sentBody(spy)).not.toHaveProperty('context');
    });

    it('reads the cohort when the question is sent, not when created', async () => {
      const spy = respond();
      const selected: { filter?: typeof filter } = {};
      const adapter = createAgentAdapter(() => selected.filter);
      selected.filter = filter;
      await run(adapter);
      expect(sentBody(spy).context).toEqual({ cohortFilter: filter });
    });
  });

  describe('tool calls', () => {
    const ask = () =>
      agentAdapter.run({
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Compare survival' }] }],
        abortSignal: new AbortController().signal,
      } as unknown as Parameters<typeof agentAdapter.run>[0]);
    const call = {
      name: 'correlation_plot',
      input: { primaryVariable: 'Overall survival', secondaryVariable: 'CGS risk' },
      status: 'success',
      result: { summary: 'S', plot: { type: 'survival' } },
    };
    const respond = (body: unknown) =>
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => body,
      } as Response);

    it('shows tool calls before the answer', async () => {
      respond({ message: 'Done.', toolCalls: [call] });
      const result = await ask();
      expect(result.content).toMatchObject([
        { type: 'tool-call', toolName: 'correlation_plot', args: call.input, result: call.result },
        { type: 'text', text: 'Done.' },
      ]);
    });

    it('finishes the run, so the agent is not called again', async () => {
      respond({ message: 'Done.', toolCalls: [call] });
      expect((await ask()).status).toEqual({ type: 'complete', reason: 'stop' });
    });

    it('accepts tool calls with no answer text', async () => {
      respond({ message: '', toolCalls: [call] });
      expect((await ask()).content).toMatchObject([{ type: 'tool-call' }]);
    });

    it('still rejects a response with neither', async () => {
      respond({ message: '  ', toolCalls: [] });
      expect((await ask()).content[0]).toEqual({
        type: 'text', text: 'The research agent is unavailable. Please try again.',
      });
    });
  });
});
