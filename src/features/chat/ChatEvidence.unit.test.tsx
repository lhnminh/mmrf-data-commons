import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatEvidenceProvider, evidenceElementId, linkChildren, useEvidenceHighlighted } from './ChatEvidence';
import type { ToolSource } from './numberLinks';

const COHORT: ToolSource = { toolCallId: 'a', title: 'Cohort Builder', summary: '334 cases' };
const MATRIX: ToolSource = { toolCallId: 'b', title: 'OncoMatrix', summary: '334 cases, 148 samples' };
const SOURCES = new Map([
  ['334', [COHORT, MATRIX]],
  ['148', [MATRIX]],
]);

const Probe: React.FC<{ readonly id: string }> = ({ id }) => (
  <div id={evidenceElementId(id)} data-testid={`probe-${id}`}>
    {useEvidenceHighlighted(id) ? 'lit' : 'dark'}
  </div>
);

const show = (children: React.ReactNode) =>
  render(
    <ChatEvidenceProvider>
      <Probe id="a" />
      <Probe id="b" />
      <p>{linkChildren(children, SOURCES)}</p>
    </ChatEvidenceProvider>,
  );

describe('linkChildren', () => {
  it('turns only matched numbers into named buttons', () => {
    show('KRAS 148 and 999.');
    expect(screen.getByRole('button', { name: '148, from OncoMatrix' }).textContent).toBe('148');
    expect(screen.queryByRole('button', { name: /999/ })).toBeNull();
    expect(screen.getByText(/999\./)).toBeTruthy();
  });

  it('names every source', () => {
    show('334');
    expect(screen.getByRole('button', { name: '334, from Cohort Builder and OncoMatrix' })).toBeTruthy();
  });

  it('walks into element children', () => {
    show(<strong>148</strong>);
    expect(screen.getByRole('button', { name: '148, from OncoMatrix' }).closest('strong')).toBeTruthy();
  });

  it('leaves code and links alone', () => {
    show(
      <>
        <code>148</code>
        <a href="#x">148</a>
      </>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('highlighting', () => {
  it('highlights sources on hover and clears on leave', async () => {
    show('148');
    const number = screen.getByRole('button', { name: '148, from OncoMatrix' });
    await userEvent.hover(number);
    expect(screen.getByTestId('probe-b').textContent).toBe('lit');
    expect(screen.getByTestId('probe-a').textContent).toBe('dark');
    await userEvent.unhover(number);
    expect(screen.getByTestId('probe-b').textContent).toBe('dark');
  });

  it('highlights sources on keyboard focus', async () => {
    show('334');
    await userEvent.tab();
    expect(screen.getByTestId('probe-a').textContent).toBe('lit');
    expect(screen.getByTestId('probe-b').textContent).toBe('lit');
  });

  it('scrolls to the first source on click', async () => {
    const scroll = jest.fn();
    Element.prototype.scrollIntoView = scroll;
    show('334');
    await userEvent.click(screen.getByRole('button', { name: /^334/ }));
    expect(scroll.mock.instances[0]).toBe(document.getElementById(evidenceElementId('a')));
  });

  it('reads as not highlighted without a provider', () => {
    render(<Probe id="a" />);
    expect(screen.getByTestId('probe-a').textContent).toBe('dark');
  });
});
