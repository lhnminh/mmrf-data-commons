import { displayToolName } from './ToolCallRow';

describe('displayToolName', () => {
  it('removes the Gateway target prefix', () => {
    expect(displayToolName('virtual-lab___check_virtual_lab_health')).toBe('check_virtual_lab_health');
  });

  it('leaves a name with no prefix alone', () => {
    expect(displayToolName('plain_name')).toBe('plain_name');
  });
});
