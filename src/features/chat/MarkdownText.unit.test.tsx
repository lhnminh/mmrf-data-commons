import React from 'react';
import { render, screen } from '@testing-library/react';
import MarkdownText from './MarkdownText';

// The Markdown packages are ES modules that Jest doesn't transform. This test covers the sections around them.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({
    children,
    components,
  }: {
    readonly children: string;
    readonly components?: { readonly p?: React.ElementType };
  }) => {
    const Paragraph = components?.p ?? 'div';
    return <Paragraph>{children}</Paragraph>;
  },
}));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => undefined }));

let mockMessage: { parts: unknown[]; status?: { type: string } } = { parts: [] };

jest.mock('@assistant-ui/react', () => ({
  useAuiState: (selector: (state: unknown) => unknown) => selector({ message: mockMessage }),
}));

const MATRIX = {
  type: 'tool-call',
  toolCallId: 'm',
  toolName: 'virtual-lab___show_oncomatrix',
  result: JSON.stringify({ status: 'ok', summary: '287 samples with a mutation.' }),
};

const show = (text: string) =>
  render(React.createElement(MarkdownText as unknown as React.FC<object>, { text } as object));

describe('MarkdownText', () => {
  beforeEach(() => {
    mockMessage = { parts: [] };
  });

  it('links numbers in answer sections once the message finishes', () => {
    mockMessage = { parts: [MATRIX], status: { type: 'complete' } };
    show('Plan for 287.\nObserved: 287 and 12.');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '287, from OncoMatrix' })).toBeTruthy();
  });

  it('links nothing while the message streams', () => {
    mockMessage = { parts: [MATRIX], status: { type: 'running' } };
    show('Observed: 287.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('labels the sections of an answer', () => {
    show('**Observed:** KRAS has 14 variants.\n\n**Limits:** Synthetic data.');
    expect(screen.getByRole('heading', { name: 'Observed' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Limits' })).toBeTruthy();
    expect(screen.getByText('KRAS has 14 variants.')).toBeTruthy();
    expect(screen.getByText('Synthetic data.')).toBeTruthy();
  });

  it('renders text with no labels as a single block', () => {
    show("I'll open the KRAS plot.");
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText("I'll open the KRAS plot.")).toBeTruthy();
  });
});
