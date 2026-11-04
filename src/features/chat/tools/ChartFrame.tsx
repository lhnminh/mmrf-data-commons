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
  return `on ${[label, cases].filter(Boolean).join(', ')}`;
};

interface ChartFrameProps {
  readonly title?: string;
  readonly cohort?: ChartCohort;
  /** Identifies this chart to anything that refers to it. */
  readonly toolCallId?: string;
  /** Sits under the chart, for actions such as follow-up questions. */
  readonly footer?: React.ReactNode;
  /** Draws the chart on the filter this result ran on. Never called without one. */
  readonly children: (filter: object) => React.ReactNode;
}

/** A chart and the cohort it ran on. The filter comes from the revision, so a chart can't drift to the selected cohort. */
const ChartFrame: React.FC<ChartFrameProps> = ({ title, cohort, footer, children }: ChartFrameProps) => {
  const filter = useCohortFilterForRevision(cohort?.revision);
  const isRunning = useAuiState((s) => s.thread.isRunning);

  return (
    <div
      data-testid="chart-frame"
      className="my-3 overflow-hidden rounded-[10px] border border-base-lighter bg-base-max"
    >
      {(title || cohort?.label) && (
        <p className="flex flex-wrap items-baseline gap-x-2 border-b border-base-lighter bg-base-lightest px-3 py-2 font-content text-[12.5px]">
          {title && <b className="font-heading text-[13px] font-semibold text-gunmetal">{title}</b>}
          {cohort?.label && <span>{cohortText(cohort)}</span>}
        </p>
      )}
      <div className="overflow-x-auto p-2.5">
        {filter ? (
          <ChartErrorBoundary>{children(filter)}</ChartErrorBoundary>
        ) : (
          <p className={NOTE}>
            {isRunning ? "Waiting for this chart's cohort…" : "This chart's cohort is no longer available"}
          </p>
        )}
      </div>
      {footer && <div className="border-t border-base-lighter bg-base-lightest px-3 py-2.5">{footer}</div>}
    </div>
  );
};

export default ChartFrame;
