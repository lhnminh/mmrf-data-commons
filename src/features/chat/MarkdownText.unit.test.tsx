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

let mockMessage: { id: string; status?: { type: string } } = { id: 'answer' };
let mockMessages: unknown[] = [];

jest.mock('@assistant-ui/react', () => ({
  useAuiState: (selector: (state: unknown) => unknown) => selector({ message: mockMessage, thread: { messages: mockMessages } }),
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
    mockMessage = { id: 'answer' };
    mockMessages = [];
  });

  it('links numbers in answer sections once the message finishes', () => {
    // The runtime can put a turn's tool calls and its answer in separate messages.
    mockMessage = { id: 'answer', status: { type: 'complete' } };
    mockMessages = [
      { id: 'q', role: 'user', content: [] },
      { id: 'tools', role: 'assistant', content: [MATRIX] },
      { id: 'answer', role: 'assistant', content: [] },
    ];
    show('Plan for 287.\nObserved: 287 and 12.');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '287, from OncoMatrix' })).toBeTruthy();
  });

  it('links nothing while the message streams', () => {
    mockMessage = { id: 'answer', status: { type: 'running' } };
    mockMessages = [{ id: 'answer', role: 'assistant', content: [MATRIX] }];
    show('Observed: 287.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps finished answers mounted when another message changes', () => {
    mockMessage = { id: 'answer', status: { type: 'complete' } };
    mockMessages = [{ id: 'answer', role: 'assistant', content: [MATRIX] }];
    const { rerender } = show('Observed: 287.');
    const before = screen.getByRole('button', { name: '287, from OncoMatrix' });

    mockMessages = [...mockMessages, { id: 'next', role: 'assistant', content: [] }];
    rerender(React.createElement(MarkdownText as unknown as React.FC<object>, { text: 'Observed: 287.' } as object));

    expect(screen.getByRole('button', { name: '287, from OncoMatrix' })).toBe(before);
  });

  it('links an answer that uses no section labels', () => {
    mockMessage = { id: 'answer', status: { type: 'complete' } };
    mockMessages = [{ id: 'answer', role: 'assistant', content: [MATRIX] }];
    show('There are 287 samples.');
    expect(screen.getByRole('button', { name: '287, from OncoMatrix' })).toBeTruthy();
  });

  it('leaves text before labelled sections unlinked', () => {
    mockMessage = { id: 'answer', status: { type: 'complete' } };
    mockMessages = [{ id: 'answer', role: 'assistant', content: [MATRIX] }];
    show('Now using 287.\nObserved: none.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('mutes Limits with a colour the theme defines', () => {
    show('Limits: synthetic.');
    expect(screen.getByRole('heading', { name: 'Limits' }).closest('section')?.className).toContain('text-gunmetal/70');
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
