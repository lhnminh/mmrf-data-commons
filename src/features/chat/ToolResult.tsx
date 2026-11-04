import React, { useState } from 'react';
import { modals } from '@mantine/modals';
import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import type { FilterSet } from '@gen3/core';
import type { SurvivalPlotData } from '@/core/features/survival/types';
import { COHORT_FILTER_INDEX } from '@/core';
import SurvivalPlot from '@/features/charts/SurvivalPlot/SurvivalPlot';
import { SurvivalPlotTypes } from '@/features/charts/SurvivalPlot/types';
import { MatrixWrapper } from '@/features/proteinpaint/MatrixWrapper';
import { ProteinPaintWrapper } from '@/features/proteinpaint/ProteinPaintWrapper';

interface CohortProposal { name: string; caseIds: string[] }
interface GeneCount { gene: string; count: number }
interface ExpressionGene { gene: string; adjustedPValue: number; log2FoldChange: number }
interface Plot {
  type: string;
  labels?: string[];
  survivalData?: SurvivalPlotData['survivalData'];
  overallStats?: Record<string, number>;
  genes?: (GeneCount | ExpressionGene)[];
  cohort?: CohortProposal;
  filter?: Record<string, unknown> | null;
  gene?: string;
  groups?: CohortProposal[];
  volcanoPng?: string;
}

function saveCohort(cohort: CohortProposal) {
  if (!cohort.caseIds.length) return;
  const filter: FilterSet = {
    mode: 'and', root: { case_id: {
      operator: 'in', field: 'case_id', operands: cohort.caseIds,
    } },
  };
  modals.openContextModal({
    modal: 'saveCohortModalMMRF', title: 'Review and save cohort', size: 'md',
    innerProps: { initialName: cohort.name, filters: { [COHORT_FILTER_INDEX]: filter }, setAsCurrentCohort: true },
  });
}

const OncoMatrixResult: React.FC<{ filter: Record<string, unknown> }> = ({ filter }) => {
  const [open, setOpen] = useState(false);
  return <div className="mt-3">
    <button type="button" onClick={() => setOpen(value => !value)}
      aria-expanded={open} className="font-semibold text-primary underline">
      {open ? 'Close' : 'Open'} interactive OncoMatrix
    </button>
    {open && <div>
      <p className="my-2 text-sm">Click a gene label in the matrix, then Lollipop to inspect its variants.</p>
      <div className="overflow-x-auto"><MatrixWrapper chartType="matrix" filterOverride={filter} /></div>
    </div>}
  </div>;
};

const LollipopResult: React.FC<{ gene: string; filter?: Record<string, unknown> | null }> = ({ gene, filter }) => {
  const [open, setOpen] = useState(false);
  return <div>
    <button type="button" onClick={() => setOpen(value => !value)}
      aria-expanded={open} className="font-semibold text-primary underline">
      {open ? 'Close' : 'Open'} {gene} Lollipop plot
    </button>
    {open && <div className="overflow-x-auto"><ProteinPaintWrapper gene={gene} filterOverride={filter} /></div>}
  </div>;
};

const ToolResult: React.FC<ToolCallMessagePartProps> = ({ toolName, result, isError }) => {
  const value = result as { summary?: string; plot?: Plot } | undefined;
  const plot = value?.plot;
  if (isError) return <p role="alert">{toolName} failed. Please try again.</p>;
  if (!plot) return null;
  const cohorts = plot.cohort ? [plot.cohort] : plot.groups ?? [];
  return <section className="my-3 rounded-md border border-base-lighter p-3" aria-label={`${toolName} result`}>
    {plot.type === 'survival' && plot.survivalData &&
      <SurvivalPlot data={{ survivalData: plot.survivalData, overallStats: plot.overallStats ?? {} }}
        names={plot.labels} plotType={SurvivalPlotTypes.categorical} field="group" />}
    {plot.type === 'top_mutated_genes' && <div>
      <h3 className="font-semibold">Top mutated genes</h3>
      {(plot.genes as GeneCount[] | undefined)?.map((gene) =>
        <div key={gene.gene} className="my-2 flex items-center gap-2">
          <span className="w-16">{gene.gene}</span>
          <div className="h-4 bg-primary" style={{ width: `${Math.max(2, gene.count / Math.max(...(plot.genes as GeneCount[]).map(g => g.count)) * 60)}%` }} />
          <span>{gene.count}</span>
        </div>)}
      {plot.filter && <OncoMatrixResult filter={plot.filter} />}
    </div>}
    {plot.type === 'lollipop' && plot.gene && <LollipopResult gene={plot.gene} filter={plot.filter} />}
    {plot.type === 'differential_expression' && <div>
      <h3 className="font-semibold">Differential expression</h3>
      {plot.volcanoPng && <img alt="Volcano plot of differential expression" className="max-w-full" src={plot.volcanoPng.startsWith('data:') ? plot.volcanoPng : `data:image/png;base64,${plot.volcanoPng}`} />}
      <table className="mt-2 w-full text-left"><thead><tr><th>Gene</th><th>Adjusted p</th><th>Log2 fold change</th></tr></thead>
        <tbody>{(plot.genes as ExpressionGene[] | undefined)?.map(gene => <tr key={gene.gene}>
          <td>{gene.gene}</td><td>{gene.adjustedPValue.toPrecision(3)}</td><td>{gene.log2FoldChange?.toFixed(2)}</td>
        </tr>)}</tbody></table>
    </div>}
    {cohorts.map(cohort => <button key={cohort.name} type="button" onClick={() => saveCohort(cohort)}
      className="mr-2 mt-3 rounded bg-secondary px-3 py-1 text-white">
      Save {cohort.name} ({cohort.caseIds.length} cases)
    </button>)}
  </section>;
};

export default ToolResult;
