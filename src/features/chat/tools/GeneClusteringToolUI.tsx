import React from 'react';
import dynamic from 'next/dynamic';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import ChartFrame, { ChartLoading, type ChartCohort } from './ChartFrame';
import { parseResult, toolMessage, toolStatus, ToolRow } from './ToolCallRow';

const TITLE = 'Gene Expression Clustering';

// ProteinPaint's client needs a browser, and most chats never draw a chart.
const MatrixWrapper = dynamic(
  () => import('@/features/proteinpaint/MatrixWrapper').then((module) => module.MatrixWrapper),
  { ssr: false, loading: () => <ChartLoading /> },
);

interface ClusteringResult {
  readonly cohort?: ChartCohort;
  readonly plot?: { readonly maxGenes: number };
}

const GeneClusteringToolUI: ToolCallMessagePartComponent = ({ toolCallId, args, result, isError, status }) => {
  const rowStatus = toolStatus(isError, result, status);
  const parsed = (rowStatus === 'Done' ? parseResult(result) : undefined) as ClusteringResult | undefined;
  const plot = parsed?.plot;

  if (!plot) {
    return (
      <ToolRow
        toolCallId={toolCallId}
        title={TITLE}
        status={rowStatus}
        settings={args}
        message={toolMessage(isError, result, status)}
      />
    );
  }
  return (
    <>
      <ToolRow toolCallId={toolCallId} title={TITLE} status={rowStatus} settings={args} />
      <ChartFrame toolCallId={toolCallId} title={TITLE} cohort={parsed.cohort}>
        {(filter) => (
          <MatrixWrapper chartType="hierCluster" filter0Override={filter} maxGenes={plot.maxGenes} generateTopGenes />
        )}
      </ChartFrame>
    </>
  );
};

export default GeneClusteringToolUI;
