import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearCohortFilters, CoreProvider, coreStore, updateCohortFilter } from '@gen3/core';
import { COHORT_FILTER_INDEX } from '@/core/constants';
import ChatCohortStrip, { cohortShare } from './ChatCohortStrip';
import { selectSelectedCohortFilterSet } from './selectedCohortFilter';

const mockCounts = jest.fn();

jest.mock('@gen3/core', () => ({
  ...jest.requireActual('@gen3/core'),
  useGetCountsQuery: (args: unknown) => mockCounts(args),
}));

const counts = (cases?: number, total?: number) =>
  mockCounts.mockImplementation(({ queryId }: { queryId: string }) => ({
    currentData: queryId === 'chat-total' ? total : cases,
  }));

const addRace = () =>
  act(() => {
    coreStore.dispatch(
      updateCohortFilter({
        index: COHORT_FILTER_INDEX,
        field: 'demographic.race',
        filter: { operator: 'in', field: 'demographic.race', operands: ['black or african american'] },
      }),
    );
  });

const show = () =>
  render(
    <CoreProvider>
      <ChatCohortStrip />
    </CoreProvider>,
  );

describe('ChatCohortStrip', () => {
  afterEach(() => {
    act(() => {
      coreStore.dispatch(clearCohortFilters({ index: COHORT_FILTER_INDEX }));
    });
  });

  it('shows all cases with no Clear All when unfiltered', () => {
    counts(1000, 1000);
    show();
    expect(screen.getByText('All cases, no filters')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear All' })).toBeNull();
  });

  it('shows a tag and the count when filtered', () => {
    counts(334, 1000);
    addRace();
    show();
    expect(screen.getByText('Race: black or african american')).toBeTruthy();
    expect(screen.getByText('334')).toBeTruthy();
    expect(screen.getByText('of 1,000 cases')).toBeTruthy();
    expect(screen.getByRole('img', { name: '334 of 1,000 cases' })).toBeTruthy();
  });

  it('clears the filters', async () => {
    counts(334, 1000);
    addRace();
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(selectSelectedCohortFilterSet(coreStore.getState()).root).toEqual({});
  });

  it('links to Cohort Builder', () => {
    counts(1000, 1000);
    show();
    expect(screen.getByRole('link', { name: 'Cohort Builder' }).getAttribute('href')).toBe('/?app=CohortBuilder');
  });

  it('shows a dash and no line until the first count arrives', () => {
    counts(undefined, undefined);
    addRace();
    show();
    expect(screen.getByText('Race: black or african american')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('keeps the last count while a new one loads', () => {
    counts(1000, 1000);
    const { rerender } = show();
    counts(undefined, 1000);
    rerender(
      <CoreProvider>
        <ChatCohortStrip />
      </CoreProvider>,
    );
    expect(screen.getByText('1,000')).toBeTruthy();
  });

  it('shows the filters with no number or line when a count fails', () => {
    mockCounts.mockReturnValue({ isError: true });
    addRace();
    show();
    expect(screen.getByText('Race: black or african american')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText(/cases$/)).toBeNull();
  });
});

describe('cohortShare', () => {
  it.each<[number | undefined, number | undefined, number | undefined]>([
    [334, 1000, 33.4],
    [0, 1000, 0],
    [5, 0, undefined],
    [undefined, 1000, undefined],
    [1000, undefined, undefined],
    [1200, 1000, 100],
  ])('of %s and %s is %s', (cases, total, share) => {
    expect(cohortShare(cases, total)).toBe(share);
  });
});
