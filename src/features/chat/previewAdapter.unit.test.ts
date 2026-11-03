import { PREVIEW_REPLY, previewAdapter } from './previewAdapter';
import { SURVIVAL_PROMPT } from './suggestedPrompts';

const ask = (text: string) =>
  previewAdapter.run({
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
  } as never);

const complete = { type: 'complete', reason: 'stop' };

describe('previewAdapter', () => {
  it('uses the agreed reply text', () => {
    expect(PREVIEW_REPLY).toBe(
      "Chat isn't connected to the research agent yet, so this question wasn't run.",
    );
  });

  it.each([
    'Show the top mutated genes in Black or African American patients',
    SURVIVAL_PROMPT.toUpperCase(),
    'survival',
  ])('gives the existing reply for %s', async (text) => {
    const result = await ask(text);
    expect(result.content).toEqual([{ type: 'text', text: PREVIEW_REPLY }]);
    expect(result.status).toEqual(complete);
  });

  it.each([SURVIVAL_PROMPT, `  ${SURVIVAL_PROMPT}\n`])(
    'plays the recording for %j',
    async (text) => {
      const result = await ask(text);
      const [tool, answer] = result.content;
      expect(tool).toMatchObject({
        type: 'tool-call',
        toolName: 'correlation_plot',
        result: { recorded: true, plot: { type: 'survival' } },
      });
      expect(answer.type).toBe('text');
      expect(result.status).toEqual(complete);
    },
  );

  it('makes no network call on any path', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await ask(SURVIVAL_PROMPT);
    await ask('anything else');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
