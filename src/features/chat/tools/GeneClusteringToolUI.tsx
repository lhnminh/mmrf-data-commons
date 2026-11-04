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

interface ClusteringPlot {
  readonly maxGenes?: number;
  readonly genes?: ReadonlyArray<string>;
}

interface ClusteringResult {
  readonly cohort?: ChartCohort;
  readonly geneSet?: { readonly id: string };
  readonly plot?: ClusteringPlot;
}

const GeneClusteringToolUI: ToolCallMessagePartComponent = ({ toolCallId, args, result, isError, status }) => {
  const rowStatus = toolStatus(isError, result, status);
  const parsed = (rowStatus === 'Done' ? parseResult(result) : undefined) as ClusteringResult | undefined;
  const plot = parsed?.plot;
  const title = parsed?.geneSet ? `${TITLE} · ${parsed.geneSet.id}` : TITLE;

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
        {(filter) => (
          <MatrixWrapper
            chartType="hierCluster"
            filter0Override={filter}
            generateTopGenes
            {...(plot.genes ? { genes: plot.genes } : { maxGenes: plot.maxGenes })}
          />
        )}
      </ChartFrame>
    </>
  );
};

export default GeneClusteringToolUI;
