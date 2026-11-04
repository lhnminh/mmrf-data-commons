import { extractNumbers, linkableSourcesKey, numberSources, toolSources, turnParts } from './numberLinks';

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

describe('turnParts', () => {
  const user = (id: string) => ({ id, role: 'user', content: [{ type: 'text', text: 'q' }] });
  const assistant = (id: string, ...content: object[]) => ({ id, role: 'assistant', content });
  const a = { type: 'tool-call', toolCallId: 'a' };
  const b = { type: 'tool-call', toolCallId: 'b' };
  const answer = { type: 'text', text: '148' };

  it('collects tool calls from earlier assistant messages in the same turn', () => {
    const messages = [user('u1'), assistant('m1', a), assistant('m2', b), assistant('m3', answer)];
    expect(turnParts(messages, 'm3')).toEqual([a, b, answer]);
  });

  it('stops at the question that started the turn', () => {
    const messages = [user('u1'), assistant('m1', a), user('u2'), assistant('m2', b), assistant('m3', answer)];
    expect(turnParts(messages, 'm3')).toEqual([b, answer]);
  });

  it('ignores later messages', () => {
    const messages = [user('u1'), assistant('m1', answer), assistant('m2', a)];
    expect(turnParts(messages, 'm1')).toEqual([answer]);
  });

  it('is empty for an unknown message', () => {
    expect(turnParts([user('u1')], 'nope')).toEqual([]);
  });
});

describe('linkableSourcesKey', () => {
  const message = (content: object[]) => [{ id: 'a', role: 'assistant', content }];

  it('stays equal when the messages change but their sources do not', () => {
    const complete = { type: 'complete' };
    const first = linkableSourcesKey(message([tool('a', '148 samples')]), 'a', complete);
    const second = linkableSourcesKey(message([tool('a', '148 samples')]), 'a', complete);
    expect(second).toBe(first);
  });

  it('changes when a source changes', () => {
    const complete = { type: 'complete' };
    expect(linkableSourcesKey(message([tool('a', '148 samples')]), 'a', complete)).not.toBe(
      linkableSourcesKey(message([tool('a', '149 samples')]), 'a', complete),
    );
  });

  it('is empty while the message streams', () => {
    expect(linkableSourcesKey(message([tool('a', '148 samples')]), 'a', { type: 'running' })).toBe('[]');
  });
});
