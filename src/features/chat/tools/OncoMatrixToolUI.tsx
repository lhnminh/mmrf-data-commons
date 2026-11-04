import React from 'react';
import dynamic from 'next/dynamic';
import { useAuiState, type ToolCallMessagePartComponent } from '@assistant-ui/react';
import ChartFrame, { ChartLoading, type ChartCohort } from './ChartFrame';
import { parseResult, toolMessage, toolStatus, ToolRow, ToolSuggestion } from './ToolCallRow';

const TITLE = 'OncoMatrix';
const MAX_FOLLOW_UPS = 3;

// ProteinPaint's client needs a browser, and most chats never draw a chart.
const MatrixWrapper = dynamic(
  () => import('@/features/proteinpaint/MatrixWrapper').then((module) => module.MatrixWrapper),
  { ssr: false, loading: () => <ChartLoading /> },
);

interface MatrixResult {
  readonly status?: string;
  readonly genes?: ReadonlyArray<{ readonly gene: string }>;
  readonly cohort?: ChartCohort;
  readonly plot?: { readonly maxGenes?: number };
}

const FollowUps: React.FC<{ readonly genes: ReadonlyArray<{ readonly gene: string }> }> = ({ genes }) => {
  const isRunning = useAuiState((s) => s.thread.isRunning);
  return (
    <div className="flex flex-wrap gap-2">
      {genes.slice(0, MAX_FOLLOW_UPS).map(({ gene }) => (
        <ToolSuggestion key={gene} prompt={`Show the Lollipop plot for ${gene}.`} disabled={isRunning}>
          Lollipop for {gene}
        </ToolSuggestion>
      ))}
    </div>
  );
};

const OncoMatrixToolUI: ToolCallMessagePartComponent = ({ toolCallId, args, result, isError, status }) => {
  const rowStatus = toolStatus(isError, result, status);
  const parsed = (rowStatus === 'Done' ? parseResult(result) : undefined) as MatrixResult | undefined;
  const genes = parsed?.genes ?? [];
  const title = genes.length > 0 ? `${TITLE} · ${genes.length} genes` : TITLE;

  if (!parsed?.plot) {
    return (
      <ToolRow
        toolCallId={toolCallId}
        title={title}
        status={rowStatus}
        settings={args}
        message={toolMessage(isError, result, status)}
      />
    );
  }
  const { maxGenes } = parsed.plot;
  return (
    <>
      <ToolRow toolCallId={toolCallId} title={title} status={rowStatus} settings={args} />
      <ChartFrame
        toolCallId={toolCallId}
        title={TITLE}
        cohort={parsed.cohort}
        footer={genes.length > 0 ? <FollowUps genes={genes} /> : undefined}
      >
        {(filter) => <MatrixWrapper chartType="matrix" filter0Override={filter} maxGenes={maxGenes} />}
      </ChartFrame>
    </>
  );
};

export default OncoMatrixToolUI;
