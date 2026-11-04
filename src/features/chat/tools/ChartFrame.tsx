import React from 'react';
import { useAuiState } from '@assistant-ui/react';
import { useCohortFilterForRevision } from '../useCohortSync';

export interface ChartCohort {
  readonly label?: string;
  readonly caseCount?: number;
  readonly revision?: number;
}

const NOTE = 'mt-1 font-content text-xs text-base-content-dark';

export const ChartLoading: React.FC = () => <p className={NOTE}>Loading the chart…</p>;

class ChartErrorBoundary extends React.Component<
  { readonly children: React.ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <p className={`${NOTE} text-utility-error`}>This chart couldn&apos;t be drawn.</p>;
  }
}

const cohortText = ({ label, caseCount }: ChartCohort) => {
  const cases =
    caseCount === undefined
      ? undefined
      : `${caseCount.toLocaleString('en-US')} ${caseCount === 1 ? 'case' : 'cases'}`;
  return `Cohort: ${[label, cases].filter(Boolean).join(', ')}`;
};

interface ChartFrameProps {
  readonly cohort?: ChartCohort;
  /** Draws the chart on the filter this result ran on. Never called without one. */
  readonly children: (filter: object) => React.ReactNode;
}

/**
 * A chart and the cohort it ran on, using the thread's full width rather than the 660px text
 * column. The filter comes from the revision, so a chart can't drift to the selected cohort.
 */
const ChartFrame: React.FC<ChartFrameProps> = ({ cohort, children }: ChartFrameProps) => {
  const filter = useCohortFilterForRevision(cohort?.revision);
  const isRunning = useAuiState((s) => s.thread.isRunning);

  return (
    <div
      data-testid="chart-frame"
      className="my-2 ml-[calc(50%-50cqw+1rem)] w-[calc(100cqw-2rem)] rounded border border-base-lighter bg-base-max"
    >
      {cohort?.label && (
        <p className="border-b border-base-lighter px-2.5 py-1.5 font-content text-xs italic">
          {cohortText(cohort)}
        </p>
      )}
      <div className="overflow-x-auto p-2">
        {filter ? (
          <ChartErrorBoundary>{children(filter)}</ChartErrorBoundary>
        ) : (
          <p className={NOTE}>
            {isRunning ? "Waiting for this chart's cohort…" : "This chart's cohort is no longer available"}
          </p>
        )}
      </div>
    </div>
  );
};

export default ChartFrame;
