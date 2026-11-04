import React from 'react';
import * as webStreams from 'node:stream/web';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearCohortFilters, coreStore, CoreProvider, updateCohortFilter } from '@gen3/core';
import { COHORT_FILTER_INDEX } from '@/core/constants';
import ChatRuntimeProvider from './ChatRuntimeProvider';
import ChatThread from './ChatThread';
import { selectSelectedCohortFilterSet } from './selectedCohortFilter';
import { useCohortFilterForRevision } from './useCohortSync';

jest.mock('./MarkdownText', () => {
  const { MessagePartPrimitive } = jest.requireActual('@assistant-ui/react');
  return { __esModule: true, default: () => <MessagePartPrimitive.Text /> };
});

jest.mock('@gen3/core', () => ({
  ...jest.requireActual('@gen3/core'),
  useGetCountsQuery: () => ({ currentData: 1000 }),
}));

const TOOL = 'virtual-lab___update_cohort';
const CHANGE = { field: 'demographic.race', label: 'Race', values: ['black or african american'], op: 'set' };
const FILTER = { and: [{ in: { 'demographic.race': ['black or african american'] } }] };

const toolRun = (result: object, after: object[] = []) => [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  { type: 'TOOL_CALL_START', toolCallId: 'c', toolCallName: TOOL },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'c', delta: '{}' },
  { type: 'TOOL_CALL_END', toolCallId: 'c' },
  { type: 'TOOL_CALL_RESULT', messageId: 'tr', toolCallId: 'c', content: JSON.stringify(result) },
  ...after,
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' },
];

const OK_RESULT = {
  status: 'ok',
  summary: 'The cohort went from 1000 to 334 cases.',
  changes: [CHANGE],
  casesBefore: 1000,
  casesAfter: 334,
  cohort: { label: 'Race: black or african american', caseCount: 334, revision: 2 },
};
const SNAPSHOT = {
  type: 'STATE_SNAPSHOT',
  snapshot: {
    cohort: { filter: FILTER, label: 'Race: black or african american', caseCount: 334, revision: 2, changes: [CHANGE] },
  },
};

const sseResponse = (events: ReadonlyArray<object>) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      events.forEach((event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};

const FilterProbe: React.FC<{ readonly revision: number }> = ({ revision }) => {
  const filter = useCohortFilterForRevision(revision);
  return <output data-testid={`filter-${revision}`}>{filter ? JSON.stringify(filter) : 'unknown'}</output>;
};

const send = async (events: ReadonlyArray<object>) => {
  global.fetch = jest.fn().mockResolvedValue(sseResponse(events));
  render(
    <CoreProvider>
      <ChatRuntimeProvider>
        <ChatThread />
        <FilterProbe revision={1} />
        <FilterProbe revision={2} />
      </ChatRuntimeProvider>
    </CoreProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Is the Virtual Lab healthy?' }));
};

const storeFields = () => Object.keys(selectSelectedCohortFilterSet(coreStore.getState()).root);

describe('Cohort sync over AG-UI', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    Object.assign(globalThis, {
      ReadableStream: webStreams.ReadableStream,
      TransformStream: webStreams.TransformStream,
      WritableStream: webStreams.WritableStream,
    });
    Element.prototype.scrollIntoView = jest.fn();
    Element.prototype.scrollTo = jest.fn();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    coreStore.dispatch(clearCohortFilters({ index: COHORT_FILTER_INDEX }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('applies the snapshot, reports the change and keeps its filter by revision', async () => {
    await send(toolRun(OK_RESULT, [SNAPSHOT]));

    expect(await screen.findByText('Cohort Builder · Updated cohort')).toBeTruthy();
    await waitFor(() => expect(storeFields()).toEqual(['demographic.race']));
    expect(screen.getByText(/Race: black or african american/)).toBeTruthy();
    expect(screen.getByText('334 cases')).toBeTruthy();
    expect(screen.getByTestId('filter-2').textContent).toBe(JSON.stringify(FILTER));
    expect(screen.getByTestId('filter-1').textContent).toBe('{"and":[]}');
  });

  it('shows the result before its snapshot, without an Undo', async () => {
    await send(toolRun(OK_RESULT));

    expect(await screen.findByText('Cohort Builder · Updated cohort')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByTestId('filter-2').textContent).toBe('unknown');
    expect(storeFields()).toEqual([]);
  });

  it('restores the cohort on Undo and leaves a record', async () => {
    await send(toolRun(OK_RESULT, [SNAPSHOT]));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(storeFields()).toEqual([]);
    expect(screen.getByText('Undone')).toBeTruthy();
    expect(screen.getByText('Cohort restored: 1,000 cases.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByTestId('filter-2').textContent).toBe(JSON.stringify(FILTER));
  });

  it('takes the Undo away after a manual edit', async () => {
    await send(toolRun(OK_RESULT, [SNAPSHOT]));
    await screen.findByRole('button', { name: 'Undo' });

    act(() => {
      coreStore.dispatch(
        updateCohortFilter({
          index: COHORT_FILTER_INDEX,
          field: 'demographic.gender',
          filter: { operator: 'in', field: 'demographic.gender', operands: ['female'] },
        }),
      );
    });

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull());
    expect(screen.queryByText('Undone')).toBeNull();
  });

  it('offers the options of an ambiguous result and changes nothing', async () => {
    await send(
      toolRun({
        status: 'ambiguous',
        summary: "'Hispanic' could mean more than one Ethnicity value.",
        label: 'Ethnicity',
        options: ['hispanic or latino', 'not hispanic or latino'],
      }),
    );

    expect(await screen.findByRole('button', { name: 'hispanic or latino' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'not hispanic or latino' })).toBeTruthy();
    expect(screen.getByText(/could mean more than one/)).toBeTruthy();
    expect(storeFields()).toEqual([]);
  });

  it.each([
    ['unknown_field', "There's no cohort field called 'favourite colour'."],
    ['would_be_empty', 'No case matches those filters.'],
  ])('shows the summary of %s and does not call it failed', async (status, summary) => {
    await send(toolRun({ status, summary }));

    expect(await screen.findByText(summary)).toBeTruthy();
    expect(screen.queryByText('Failed')).toBeNull();
  });

  it('shows a tool that reports an error as failed', async () => {
    await send(toolRun({ status: 'error', summary: 'The data query failed.' }));

    expect(await screen.findByText('Failed')).toBeTruthy();
    expect(screen.getByText('The data query failed.')).toBeTruthy();
    expect(storeFields()).toEqual([]);
  });

  it('sends the cohort as state, with no filter in the context', async () => {
    await send(toolRun({ status: 'unknown_field', summary: 'x' }));
    await screen.findByText('x');

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.state.cohort).toEqual({
      filter: null,
      label: 'All cases',
      caseCount: 1000,
      revision: 1,
      changedOutsideChat: false,
    });
    expect(body.context).toEqual([]);
    expect(body.tools).toEqual([]);
  });
});
