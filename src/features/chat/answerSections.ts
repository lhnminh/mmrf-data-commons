export type AnswerLabel = 'Observed' | 'Limits' | 'Interpretation';

export interface AnswerSection {
  readonly label: AnswerLabel;
  readonly body: string;
}

export interface SplitAnswer {
  readonly preamble: string;
  readonly sections: ReadonlyArray<AnswerSection>;
}

// A label starts its line and either stands alone or is followed by a colon, so "Limits of this
// cohort" stays prose. It can carry heading or bold markers, with the colon inside or outside the bold.
const LABEL_LINE =
  /^ {0,3}(?:#{1,6}\s*)?(?:\*\*|__)?(Observed|Limits|Interpretation)(?::(?:\*\*|__)?\s*(.*)|(?:\*\*|__)(?::\s*(.*))?|\s*)$/i;

const canonicalLabel = (label: string) =>
  (label[0].toUpperCase() + label.slice(1).toLowerCase()) as AnswerLabel;

/** Splits an answer at the labels the agent is told to write. Text with no labels comes back whole. */
export const splitAnswerSections = (text: string): SplitAnswer => {
  const preamble: string[] = [];
  const sections: Array<{ label: AnswerLabel; lines: string[] }> = [];

  for (const line of text.split('\n')) {
    const match = LABEL_LINE.exec(line);
    if (match) {
      sections.push({ label: canonicalLabel(match[1]), lines: [match[2] ?? match[3] ?? ''] });
    } else if (sections.length > 0) {
      sections[sections.length - 1].lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  if (sections.length === 0) return { preamble: text, sections: [] };
  return {
    preamble: preamble.join('\n').trim(),
    sections: sections.map(({ label, lines }) => ({ label, body: lines.join('\n').trim() })),
  };
};
