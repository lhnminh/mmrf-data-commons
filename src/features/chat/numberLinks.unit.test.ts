import { extractNumbers, linkableSources, numberSources, toolSources } from './numberLinks';

const values = (text: string) => extractNumbers(text).map((n) => n.value);

describe('extractNumbers', () => {
  it('normalises commas', () => {
    expect(values('1,000 → 334 cases')).toEqual(['1000', '334']);
  });

  it('reads brackets and sentence ends', () => {
    expect(values('p.Q61H (38), TP53 38.')).toEqual(['38', '38']);
  });

  it('keeps decimals and exponents whole', () => {
    expect(values('p = 7.1e-60 and 0.5')).toEqual(['7.1e-60', '0.5']);
  });

  it.each(['p.G12V', 'c.238+2T>C', 'SYNTH-CASE-0001', '1,000a', 'hg38', 'ENSG00000133703'])('skips %s', (text) => {
    expect(values(text)).toEqual([]);
  });

  it('reports where each number sits', () => {
    expect(extractNumbers('KRAS 1,000!')).toEqual([{ raw: '1,000', value: '1000', start: 5, end: 10 }]);
  });
});

const tool = (toolCallId: string, summary: unknown, toolName = 'virtual-lab___show_oncomatrix') => ({
  type: 'tool-call',
  toolCallId,
  toolName,
  result: JSON.stringify({ status: 'ok', summary }),
});

describe('numberSources', () => {
  it('finds every step whose summary has the number', () => {
    const map = numberSources(
      toolSources([
        tool('a', 'The cohort went from 1000 to 334 cases.', 'virtual-lab___update_cohort'),
        tool('b', '334 cases, 287 samples with a mutation in these genes.'),
      ]),
    );
    expect(map.get('334')?.map((s) => s.toolCallId)).toEqual(['a', 'b']);
    expect(map.get('287')?.map((s) => s.title)).toEqual(['OncoMatrix']);
    expect(map.get('999')).toBeUndefined();
  });

  it('lists a step once even if its summary repeats the number', () => {
    const map = numberSources(toolSources([tool('a', '5 of 5 samples')]));
    expect(map.get('5')?.map((s) => s.toolCallId)).toEqual(['a']);
  });

  it('ignores results with no usable summary', () => {
    expect(
      toolSources([
        { type: 'tool-call', toolCallId: 'x', toolName: 't', result: 'not json' },
        { type: 'tool-call', toolCallId: 'y', toolName: 't' },
        { type: 'text', text: '148' },
        tool('z', 12),
        null,
      ]),
    ).toEqual([]);
  });
});

describe('linkableSources', () => {
  const parts = [tool('a', '148 samples')];

  it('adds no links until the message finishes', () => {
    expect(linkableSources(parts, { type: 'running' }).size).toBe(0);
    expect(linkableSources(parts, undefined).size).toBe(0);
    expect(linkableSources(parts, { type: 'complete' }).size).toBe(1);
  });
});
