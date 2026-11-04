import React from 'react';
import { render, screen } from '@testing-library/react';
import GeneClusteringToolUI from './GeneClusteringToolUI';

const mockChart = jest.fn();

jest.mock('next/dynamic', () => () => {
  const Chart = (props: object) => {
    mockChart(props);
    return <div data-testid="clustering-chart" />;
  };
  return Chart;
});

jest.mock('./ChartFrame', () => ({
  __esModule: true,
  ChartLoading: () => null,
  default: ({ children }: { readonly children: (filter: object) => React.ReactNode }) => (
    <div>{children({ and: [] })}</div>
  ),
}));

jest.mock('@assistant-ui/react', () => ({ ThreadPrimitive: { Suggestion: () => null } }));

const RESULT = {
  status: 'ok',
  summary: '167 cases. Gene expression heatmap of the top 20 variably expressed genes.',
  cohort: { label: 'Race: black or african american, Sex: male', caseCount: 167, revision: 1 },
  genes: ['IGLC2', 'IGKC'],
  plot: { type: 'gene_clustering', maxGenes: 20 },
};

const show = (result: unknown) =>
  render(
    React.createElement(GeneClusteringToolUI as unknown as React.FC<object>, {
      toolName: 'virtual-lab___show_gene_clustering',
      args: {},
      result,
      isError: false,
      status: { type: 'complete' },
    } as object),
  );

describe('GeneClusteringToolUI', () => {
  beforeEach(() => mockChart.mockClear());

  it('generates the heatmap on the frame filter', () => {
    show(RESULT);

    expect(mockChart).toHaveBeenCalledWith({
      chartType: 'hierCluster',
      filter0Override: { and: [] },
      maxGenes: 20,
      generateTopGenes: true,
    });
    expect(screen.getAllByText('Gene Expression Clustering').length).toBeGreaterThan(0);
  });

  it('shows only the tool row without a plot', () => {
    show({ status: 'too_few_samples', summary: 'Ranking genes needs at least 10 samples.' });

    expect(mockChart).not.toHaveBeenCalled();
    expect(screen.getByText('Ranking genes needs at least 10 samples.')).toBeInTheDocument();
  });
});
