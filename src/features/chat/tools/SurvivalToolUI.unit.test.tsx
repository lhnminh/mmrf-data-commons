import React from 'react';
import { render, screen } from '@testing-library/react';
import SurvivalToolUI, { survivalPlots } from './SurvivalToolUI';

const mockChart = jest.fn();

jest.mock('next/dynamic', () => () => {
  const Chart = (props: object) => {
    mockChart(props);
    return <div data-testid="survival-chart" />;
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

const COMPARISON = {
  status: 'ok',
  summary: '1000 cases, overall survival, compared by CGS risk.',
  cohort: { label: 'All cases', caseCount: 1000, revision: 1 },
  groups: ['High risk', 'Standard risk'],
  comparedBy: 'CGS risk',
  plot: { type: 'survival', term: 'overall_survival', compareBy: 'cgs_risk_category' },
};

const show = (result: unknown, args: object = {}, isError = false) =>
  render(
    React.createElement(SurvivalToolUI as unknown as React.FC<object>, {
      toolName: 'virtual-lab___show_survival',
      args,
      result,
      isError,
      status: { type: 'complete' },
    } as object),
  );

describe('SurvivalToolUI', () => {
  beforeEach(() => mockChart.mockClear());

  it('titles a comparison and draws the chart on the frame filter', () => {
    show(COMPARISON);

    expect(screen.getByText('Correlation Plot · Survival · CGS risk')).toBeInTheDocument();
    expect(mockChart).toHaveBeenCalledWith({
      filter0Override: { and: [] },
      plots: survivalPlots(COMPARISON.plot),
    });
  });

  it('titles one curve without a comparison', () => {
    show({ ...COMPARISON, comparedBy: undefined, plot: { type: 'survival', term: 'overall_survival' } });

    expect(screen.getByText('Correlation Plot · Survival')).toBeInTheDocument();
  });

  it('shows Inputs with compareBy', () => {
    show(COMPARISON, { compareBy: 'CGS risk' });

    expect(screen.getByText('compareBy:')).toBeInTheDocument();
    expect(screen.getByText('Inputs')).toBeInTheDocument();
  });

  it('shows the message and no chart without a plot', () => {
    show({ status: 'unsupported_comparison', summary: "There's no survival comparison by 'TP53' yet." }, { compareBy: 'TP53' });

    expect(screen.getByText("There's no survival comparison by 'TP53' yet.")).toBeInTheDocument();
    expect(screen.queryByTestId('survival-chart')).not.toBeInTheDocument();
  });

  it('draws the single curve for one_group', () => {
    show({ ...COMPARISON, status: 'one_group', groups: ['High risk'] });

    expect(screen.getByTestId('survival-chart')).toBeInTheDocument();
  });

  it('shows Failed with no chart on an error', () => {
    show({ status: 'error', summary: 'The Virtual Lab refused the login.', step: 'auth_failed' });

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('The Virtual Lab refused the login.')).toBeInTheDocument();
    expect(screen.queryByTestId('survival-chart')).not.toBeInTheDocument();
  });
});

describe('survivalPlots', () => {
  it('opens the survival chart with an overlay', () => {
    expect(survivalPlots({ term: 'overall_survival', compareBy: 'cgs_risk_category' })).toEqual([
      { chartType: 'survival', term: { id: 'overall_survival' }, term2: { id: 'cgs_risk_category' } },
    ]);
  });

  it('opens one curve without term2', () => {
    expect(survivalPlots({ term: 'overall_survival' })).toEqual([
      { chartType: 'survival', term: { id: 'overall_survival' } },
    ]);
  });
});
