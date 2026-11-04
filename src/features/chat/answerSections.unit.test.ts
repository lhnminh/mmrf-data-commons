import { splitAnswerSections } from './answerSections';

describe('splitAnswerSections', () => {
  it.each([
    'Observed: 148 samples',
    '**Observed:** 148 samples',
    '**Observed**: 148 samples',
    '## Observed\n148 samples',
    'Observed\n148 samples',
    '**Observed**\n148 samples',
    'observed: 148 samples',
  ])('finds the label in %j', (text) => {
    expect(splitAnswerSections(text)).toEqual({
      preamble: '',
      sections: [{ label: 'Observed', body: '148 samples' }],
    });
  });

  it('splits every section and keeps text before them', () => {
    expect(splitAnswerSections('Now using: All cases.\nObserved: a\nmore\nLimits: b\nInterpretation: c')).toEqual({
      preamble: 'Now using: All cases.',
      sections: [
        { label: 'Observed', body: 'a\nmore' },
        { label: 'Limits', body: 'b' },
        { label: 'Interpretation', body: 'c' },
      ],
    });
  });

  it.each(['Limits of this cohort are unclear.', 'Observed results vary.', '- Limits: in a list', 'Obser', ''])(
    'leaves %j as prose',
    (text) => {
      expect(splitAnswerSections(text)).toEqual({ preamble: text, sections: [] });
    },
  );
});
