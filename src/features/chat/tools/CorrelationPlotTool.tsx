import React, { useMemo } from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import SurvivalPlot from '@/features/charts/SurvivalPlot/SurvivalPlot';
import { SurvivalPlotTypes } from '@/features/charts/SurvivalPlot/types';
import type { AgentToolResult, CorrelationPlot } from '../agentResponse';
import { toSurvivalPlotData } from './survivalPlotData';
import { ToolRow, toolError, toolStatus } from './ToolCallRow';

interface CorrelationPlotArgs {
  readonly primaryVariable?: string;
  readonly secondaryVariable?: string;
}

// Shorter than SurvivalPlot's default, so more of a result fits in the chat's scroll area.
const CHART_HEIGHT = 260;

const SurvivalChart: React.FC<{ readonly plot: CorrelationPlot }> = ({ plot }) => {
  const data = useMemo(() => toSurvivalPlotData(plot), [plot]);
  return (
    <SurvivalPlot
      plotType={SurvivalPlotTypes.cohortComparison}
      names={plot.labels}
      data={data}
      height={CHART_HEIGHT}
    />
  );
};

const CorrelationPlotTool: ToolCallMessagePartComponent<
  CorrelationPlotArgs,
  AgentToolResult
> = ({ args, result, isError }) => {
  const plot = result?.plot as CorrelationPlot | undefined;
  const status = toolStatus(isError, result);

  return (
    <div className="mb-2 flex flex-col gap-2">
      <ToolRow
        title="Correlation Plot"
        detail={`${args.primaryVariable} × ${args.secondaryVariable}`}
        status={status}
        message={isError ? toolError(result) : undefined}
      />
      {status === 'Done' &&
        (plot?.type === 'survival' ? (
          <SurvivalChart plot={plot} />
        ) : (
          <p className="break-words">{result?.summary}</p>
        ))}
    </div>
  );
};

export default CorrelationPlotTool;
