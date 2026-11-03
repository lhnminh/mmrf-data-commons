import { PREVIEW_REPLY, previewAdapter } from './previewAdapter';

describe('previewAdapter', () => {
  it('returns the fixed reply without calling the network', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await previewAdapter.run();
    expect(result.content).toEqual([{ type: 'text', text: PREVIEW_REPLY }]);
    expect(PREVIEW_REPLY).toBe(
      "Chat isn't connected to the research agent yet, so this question wasn't run.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
