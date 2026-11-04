import { displayToolName, toolFailure, toolStatus } from './ToolCallRow';

describe('displayToolName', () => {
  it('removes the Gateway target prefix', () => {
    expect(displayToolName('virtual-lab___check_virtual_lab_health')).toBe('check_virtual_lab_health');
  });

  it('leaves a name with no prefix alone', () => {
    expect(displayToolName('plain_name')).toBe('plain_name');
  });
});

describe('tool results', () => {
  const failed = { ok: false, error: 'auth_failed', summary: 'The login was refused.' };

  it.each([
    ['a JSON string', JSON.stringify(failed)],
    ['an object', failed],
  ])('finds a failure reported as %s', (_name, result) => {
    expect(toolStatus(false, result)).toBe('Failed');
    expect(toolFailure(result)).toBe('The login was refused.');
  });

  it.each([
    ['success', '{"ok":true,"summary":"Fine."}'],
    ['text that is not JSON', 'plain text'],
    ['JSON that is not an object', '[1]'],
    ['null', null],
  ])('treats %s as done', (_name, result) => {
    expect(toolStatus(false, result)).toBe('Done');
    expect(toolFailure(result)).toBeUndefined();
  });

  it('is running until a result arrives', () => {
    expect(toolStatus(false, undefined)).toBe('Running');
  });

  it('gives a failure with no summary a generic reason', () => {
    expect(toolFailure({ ok: false })).toBe('The tool reported a failure.');
  });
});
