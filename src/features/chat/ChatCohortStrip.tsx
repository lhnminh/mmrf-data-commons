import React, { useRef } from 'react';
import Link from 'next/link';
import {
  Accessibility,
  clearCohortFilters,
  selectCurrentCohortId,
  selectCurrentCohortName,
  useCoreDispatch,
  useCoreSelector,
  useGetCountsQuery,
  type CoreState,
  type FilterSet,
} from '@gen3/core';
import { COHORT_FILTER_INDEX } from '@/core/constants';
import { cohortFilterLabels } from './cohortSync';
import { selectSelectedCohortFilterSet } from './selectedCohortFilter';

// The cohort bar's own query, as in pages/index.tsx.
const COUNT_QUERY = {
  type: COHORT_FILTER_INDEX,
  accessibility: Accessibility.ALL,
  indexPrefix: 'CaseCentric_',
};
const NO_FILTERS: FilterSet = { mode: 'and', root: {} };

/** The cohort's share of all cases, 0-100, or undefined if it can't be worked out. */
export const cohortShare = (cases?: number, total?: number): number | undefined => {
  if (cases === undefined || !total) return undefined;
  return Math.min(100, (cases / total) * 100);
};

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const TEXT_ACTION = `font-heading text-xs font-semibold text-primary hover:underline ${FOCUS_RING}`;

/** Chat's slim stand-in for the cohort bar and filter panel. Cohorts are managed in Cohort Builder. */
const ChatCohortStrip: React.FC = () => {
  const dispatch = useCoreDispatch();
  const name = useCoreSelector((state: CoreState) => selectCurrentCohortName(state));
  const queryId = useCoreSelector((state: CoreState) => selectCurrentCohortId(state));
  const filters = useCoreSelector((state: CoreState) => selectSelectedCohortFilterSet(state));

  const casesQuery = useGetCountsQuery({ ...COUNT_QUERY, filters, queryId });
  const totalQuery = useGetCountsQuery({ ...COUNT_QUERY, filters: NO_FILTERS, queryId: 'chat-total' });

  // A new query has no data until it answers, so hold the last count rather than flicker.
  const lastCases = useRef<number | undefined>(undefined);
  const lastTotal = useRef<number | undefined>(undefined);
  lastCases.current = casesQuery.currentData ?? lastCases.current;
  lastTotal.current = totalQuery.currentData ?? lastTotal.current;

  const failed = casesQuery.isError || totalQuery.isError;
  const cases = failed ? undefined : lastCases.current;
  const total = failed ? undefined : lastTotal.current;
  const share = cohortShare(cases, total);
  const labels = cohortFilterLabels(filters);

  return (
    <div className="relative flex min-h-[46px] flex-wrap items-center gap-x-3 gap-y-1 bg-base-lightest px-5 py-2 font-content text-sm text-gunmetal">
      <span className="rounded-md border border-base-lighter bg-base-max px-2.5 py-1 font-heading text-xs font-semibold">
        {name}
      </span>
      {labels.length > 0 ? (
        <>
          {labels.map((label) => (
            <span key={label} className="rounded-full bg-seashell px-2.5 py-1 text-xs">
              {label}
            </span>
          ))}
          <button
            type="button"
            className={TEXT_ACTION}
            onClick={() => dispatch(clearCohortFilters({ index: COHORT_FILTER_INDEX }))}
          >
            Clear All
          </button>
        </>
      ) : (
        <span className="text-xs">All cases, no filters</span>
      )}
      <Link href="/?app=CohortBuilder" className={TEXT_ACTION}>
        Cohort Builder
      </Link>
      {!failed && (
        <span className="ml-auto flex items-baseline gap-1.5">
          <span className="font-heading text-lg font-semibold tabular-nums">
            {cases === undefined ? '—' : cases.toLocaleString('en-US')}
          </span>
          {total !== undefined && <span className="text-xs">of {total.toLocaleString('en-US')} cases</span>}
        </span>
      )}
      {share !== undefined && (
        <div
          role="img"
          aria-label={`${cases?.toLocaleString('en-US')} of ${total?.toLocaleString('en-US')} cases`}
          className="absolute inset-x-0 bottom-0 h-[3px] bg-base-lighter"
        >
          <div
            className="h-full rounded-r-sm bg-primary motion-safe:transition-[width] motion-safe:duration-700"
            style={{ width: `${share}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ChatCohortStrip;
