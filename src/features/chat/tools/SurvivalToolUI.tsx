import React from 'react';
import dynamic from 'next/dynamic';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import ChartFrame, { ChartLoading, type ChartCohort } from './ChartFrame';
import { parseResult, toolMessage, toolStatus, ToolRow } from './ToolCallRow';

const TITLE = 'Correlation Plot · Survival';

// ProteinPaint's client needs a browser, and most chats never draw a chart.
const CorrelationWrapper = dynamic(
  () => import('@/features/proteinpaint/CorrelationWrapper').then((module) => module.CorrelationWrapper),
  { ssr: false, loading: () => <ChartLoading /> },
);

interface SurvivalPlot {
  readonly term: string;
  readonly compareBy?: string;
}

interface SurvivalResult {
  readonly comparedBy?: string;
  readonly cohort?: ChartCohort;
  readonly plot?: SurvivalPlot;
}

/** What ProteinPaint needs to open the survival chart straight away. */
export const survivalPlots = ({ term, compareBy }: SurvivalPlot): ReadonlyArray<object> => [
  {
    chartType: 'survival',
    term: { id: term },
    ...(compareBy ? { term2: { id: compareBy } } : {}),
  },
];

const SurvivalToolUI: ToolCallMessagePartComponent = ({ toolCallId, args, result, isError, status }) => {
  const rowStatus = toolStatus(isError, result, status);
  const parsed = (rowStatus === 'Done' ? parseResult(result) : undefined) as SurvivalResult | undefined;
  const title = parsed?.comparedBy ? `${TITLE} · ${parsed.comparedBy}` : TITLE;
  const plot = parsed?.plot;

  if (!plot) {
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
  return (
    <>
      <ToolRow toolCallId={toolCallId} title={title} status={rowStatus} settings={args} />
      <ChartFrame toolCallId={toolCallId} title={title} cohort={parsed.cohort}>
        {(filter) => <CorrelationWrapper filter0Override={filter} plots={survivalPlots(plot)} />}
      </ChartFrame>
    </>
  );
};

export default SurvivalToolUI;
