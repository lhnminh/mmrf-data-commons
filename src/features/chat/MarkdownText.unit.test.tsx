import React from 'react';
import { render, screen } from '@testing-library/react';
import MarkdownText from './MarkdownText';

// The Markdown packages are ES modules that Jest doesn't transform. This test covers the sections around them.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { readonly children: string }) => <div>{children}</div>,
}));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => undefined }));

const show = (text: string) =>
  render(React.createElement(MarkdownText as unknown as React.FC<object>, { text } as object));

describe('MarkdownText', () => {
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
