import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatEvidenceProvider, evidenceElementId, linkChildren } from '../ChatEvidence';
import {
  displayToolName,
  ToolRow,
  toolFailure,
  toolMessage,
  toolStatus,
  ToolSuggestion,
  type ToolStatus,
} from './ToolCallRow';

const mockSuggestion = jest.fn();

jest.mock('@assistant-ui/react', () => ({
  ThreadPrimitive: {
    Suggestion: (props: { readonly children: React.ReactNode }) => {
      mockSuggestion(props);
      return <button type="button">{props.children}</button>;
    },
  },
}));

describe('ToolSuggestion', () => {
  it('sends without clearing the composer, which a message part cannot reach', () => {
    render(<ToolSuggestion prompt="Show the Lollipop plot for KRAS.">Lollipop for KRAS</ToolSuggestion>);

    expect(screen.getByRole('button', { name: 'Lollipop for KRAS' })).toBeInTheDocument();
    expect(mockSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Show the Lollipop plot for KRAS.',
        send: true,
        clearComposer: false,
      }),
    );
  });
});

describe('displayToolName', () => {
  it('removes the Gateway target prefix', () => {
    expect(displayToolName('virtual-lab___check_virtual_lab_health')).toBe('check_virtual_lab_health');
  });

  it('leaves a name with no prefix alone', () => {
    expect(displayToolName('plain_name')).toBe('plain_name');
  });
});

describe('tool results', () => {
  const failed = { status: 'error', summary: 'The login was refused.' };

  it.each([
    ['a JSON string', JSON.stringify(failed)],
    ['an object', failed],
  ])('finds a failure reported as %s', (_name, result) => {
    expect(toolStatus(false, result)).toBe('Failed');
    expect(toolFailure(result)).toBe('The login was refused.');
  });

  it.each([
    ['success', '{"status":"ok","summary":"Fine."}'],
    ['an outcome that is not a failure', '{"status":"none_in_cohort","summary":"0 of 334 cases."}'],
    ['the retired failure shape', '{"ok":false,"summary":"Old."}'],
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
    expect(toolFailure({ status: 'error' })).toBe('The tool reported a failure.');
  });

  it('fails a tool whose run ended before it did', () => {
    expect(toolStatus(false, undefined, { type: 'incomplete', reason: 'error' })).toBe('Failed');
  });

  it('shows the summary of a result that is not a failure', () => {
    expect(toolMessage(false, '{"status":"no_data_for_gene","summary":"Not in this dataset."}')).toBe(
      'Not in this dataset.',
    );
  });

  it('shows the failure of an errored call', () => {
    expect(toolMessage(true, { error: 'Timed out' })).toBe('Timed out');
    expect(toolMessage(false, failed)).toBe('The login was refused.');
  });

  it('explains a tool that never finished', () => {
    expect(toolMessage(false, undefined, { type: 'incomplete', reason: 'error' })).toBe(
      'This step did not finish.',
    );
  });
});

describe('ToolRow details', () => {
  const details = (container: HTMLElement) => container.querySelector('details');

  it('folds away the settings of a step', () => {
    const { container } = render(
      <ToolRow title="Step" status="Done" settings={{ gene: 'KRAS', maxGenes: 3, list: [{ a: 1 }] }} />,
    );
    expect(details(container)?.open).toBe(false);
    expect(details(container)?.textContent).toContain('gene');
    expect(details(container)?.textContent).toContain('KRAS');
    expect(details(container)?.textContent).toContain('3');
    expect(details(container)?.textContent).toContain('[{"a":1}]');
  });

  it('names the settings Inputs', () => {
    const { container } = render(<ToolRow title="Step" status="Done" settings={{ gene: 'KRAS' }} />);
    expect(container.querySelector('summary')?.textContent).toBe('Inputs');
  });

  it.each<[ToolStatus, boolean]>([
    ['Running', true],
    ['Done', false],
    ['Failed', true],
  ])('shows the %s status as text, visibly: %s', (status, visible) => {
    render(<ToolRow title="Step" status={status} />);
    expect(screen.getByText(status).classList.contains('sr-only')).toBe(!visible);
  });

  it('has nothing to expand without settings', () => {
    const { container } = render(<ToolRow title="Step" status="Done" settings={{}} message="Fine." />);
    expect(details(container)).toBeNull();
    expect(screen.getByText('Fine.')).toBeTruthy();
  });

  it('keeps an ordinary message outside the details', () => {
    const { container } = render(
      <ToolRow title="Step" status="Done" settings={{ gene: 'EGFR' }} message="Not in this dataset." />,
    );
    expect(details(container)?.textContent).not.toContain('Not in this dataset.');
    expect(screen.getByText('Not in this dataset.')).toBeTruthy();
  });

  it('opens on a failure and shows it', () => {
    const { container } = render(
      <ToolRow title="Step" status="Failed" settings={{ gene: 'KRAS' }} message="Timed out" />,
    );
    expect(details(container)?.open).toBe(true);
    expect(details(container)?.textContent).toContain('Timed out');
  });

  it('shows a failure with no settings', () => {
    const { container } = render(<ToolRow title="Step" status="Failed" message="Timed out" />);
    expect(details(container)?.open).toBe(true);
    expect(screen.getByText('Timed out')).toBeTruthy();
  });
});

describe('ToolRow evidence', () => {
  it('stands out while a number from this step is under the pointer', async () => {
    const source = { toolCallId: 'a', title: 'OncoMatrix', summary: '148 samples' };
    const { container } = render(
      <ChatEvidenceProvider>
        <ToolRow title="Step" status="Done" toolCallId="a" />
        <p>{linkChildren('148', new Map([['148', [source]]]))}</p>
      </ChatEvidenceProvider>,
    );
    const step = container.querySelector(`#${evidenceElementId('a')}`);
    expect(step?.classList.contains('bg-seashell')).toBe(false);
    await userEvent.hover(screen.getByRole('button', { name: '148, from OncoMatrix' }));
    expect(step?.classList.contains('bg-seashell')).toBe(true);
  });
});
