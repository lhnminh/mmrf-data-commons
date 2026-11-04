import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AbstractAgent } from '@ag-ui/client';
import { useAuiState } from '@assistant-ui/react';
import { useAgUiSetState, useAgUiState } from '@assistant-ui/react-ag-ui';
import {
  Accessibility,
  coreStore,
  selectCurrentCohortId,
  useCoreSelector,
  useGetCountsQuery,
  type CoreState,
} from '@gen3/core';
import isEqual from 'lodash/isEqual';
import { COHORT_FILTER_INDEX } from '@/core/constants';
import { CohortSync, type CohortState } from './cohortSync';
import { selectSelectedCohortFilterSet } from './selectedCohortFilter';

/** Same as the CountsPanel in pages/index.tsx, so this reads the cohort bar's own query. */
const COHORT_BAR_INDEX_PREFIX = 'CaseCentric_';

interface AgentState {
  readonly cohort?: CohortState;
}

const cohortOf = (state: unknown) => (state as AgentState | null | undefined)?.cohort;

const CohortContext = createContext<CohortSync | null>(null);

const useSync = () => {
  const sync = useContext(CohortContext);
  if (!sync) throw new Error('Cohort hooks need a CohortProvider');
  return sync;
};

const useSyncVersion = (sync: CohortSync) =>
  useSyncExternalStore(sync.subscribe, sync.getVersion, sync.getVersion);

/** The selected cohort's case count, or undefined until the count for its filters is in. */
const useSelectedCaseCount = () => {
  const filters = useCoreSelector((state: CoreState) => selectSelectedCohortFilterSet(state));
  const queryId = useCoreSelector((state: CoreState) => selectCurrentCohortId(state));
  const { currentData } = useGetCountsQuery({
    type: COHORT_FILTER_INDEX,
    filters,
    accessibility: Accessibility.ALL,
    queryId,
    indexPrefix: COHORT_BAR_INDEX_PREFIX,
  });
  return currentData;
};

interface CohortProviderProps {
  readonly agent: AbstractAgent;
  readonly children: ReactNode;
}

/** Must sit inside the runtime provider and the platform's CoreProvider. */
export const CohortProvider = ({ agent, children }: CohortProviderProps) => {
  const [sync] = useState(
    () =>
      new CohortSync({
        getFilterSet: () => selectSelectedCohortFilterSet(coreStore.getState()),
        dispatch: (action) => coreStore.dispatch(action),
      }),
  );
  const version = useSyncVersion(sync);
  const caseCount = useSelectedCaseCount();
  const sentState = useAgUiState<AgentState>();
  const setAgentState = useAgUiSetState<AgentState>();
  const isRunning = useAuiState((s) => s.thread.isRunning);

  // The agent's own subscriber, not useAgUiState: React batches state, and could skip a
  // revision when two snapshots arrive together. This sees every event, in order.
  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onRunInitialized: ({ input }) => sync.runStarted(cohortOf(input.state)),
      onStateSnapshotEvent: ({ event }) => sync.snapshot(cohortOf(event.snapshot)),
    });
    return unsubscribe;
  }, [agent, sync]);

  // Synchronous, so a message sent straight after a manual change carries it. Without a case
  // count: the one in hand is for the old filters, and the effect below adds the new one.
  const setAgentStateRef = useRef(setAgentState);
  setAgentStateRef.current = setAgentState;
  useEffect(() => {
    return coreStore.subscribe(() => {
      if (sync.storeChanged()) setAgentStateRef.current({ cohort: sync.outgoing() });
    });
  }, [sync]);

  // A run's snapshots overwrite the state to send, and may echo a stale flag.
  useEffect(() => {
    if (isRunning) return;
    const cohort = sync.outgoing(caseCount);
    if (!isEqual(sentState?.cohort, cohort)) setAgentState({ cohort });
  }, [sync, setAgentState, isRunning, sentState, caseCount, version]);

  return createElement(CohortContext.Provider, { value: sync }, children);
};

/** The filter a revision ran on, so a chart keeps its own cohort. Undefined until it's known. */
export const useCohortFilterForRevision = (revision: number | undefined): object | undefined => {
  const sync = useSync();
  useSyncVersion(sync);
  return revision === undefined ? undefined : sync.filterFor(revision);
};

/** Undo for the change at a revision. */
export const useCohortUndo = (revision: number | undefined) => {
  const sync = useSync();
  useSyncVersion(sync);
  return {
    canUndo: revision !== undefined && sync.canUndo(revision),
    isUndone: revision !== undefined && sync.isUndone(revision),
    undo: () => revision !== undefined && sync.undo(revision),
  };
};
