import React from 'react';
import dynamic from 'next/dynamic';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import ChartFrame, { ChartLoading, type ChartCohort } from './ChartFrame';
import { parseResult, toolMessage, toolStatus, ToolRow } from './ToolCallRow';

const TITLE = 'ProteinPaint · Lollipop plot';

// ProteinPaint's client needs a browser, and most chats never draw a chart.
const ProteinPaintWrapper = dynamic(
  () => import('@/features/proteinpaint/ProteinPaintWrapper').then((module) => module.ProteinPaintWrapper),
  { ssr: false, loading: () => <ChartLoading /> },
);

interface LollipopResult {
  readonly status?: string;
  readonly gene?: string;
  readonly cohort?: ChartCohort;
  readonly plot?: { readonly gene?: string };
}

const LollipopToolUI: ToolCallMessagePartComponent = ({ toolCallId, args, result, isError, status }) => {
  const rowStatus = toolStatus(isError, result, status);
  const parsed = (rowStatus === 'Done' ? parseResult(result) : undefined) as LollipopResult | undefined;
  const asked = (args as { gene?: unknown } | undefined)?.gene;
  const gene = parsed?.plot?.gene ?? parsed?.gene ?? (typeof asked === 'string' ? asked : undefined);
  const title = gene ? `${TITLE} · ${gene}` : TITLE;

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
  return (
    <>
      <ToolRow toolCallId={toolCallId} title={title} status={rowStatus} settings={args} />
      <ChartFrame toolCallId={toolCallId} title={gene ? `Lollipop plot · ${gene}` : 'Lollipop plot'} cohort={parsed.cohort}>
        {(filter) => <ProteinPaintWrapper filter0Override={filter} gene={gene} />}
      </ChartFrame>
    </>
  );
};

export default LollipopToolUI;
