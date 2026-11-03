import { toSurvivalPlotData } from './survivalPlotData';

const plot = (unit: string) => ({
  type: 'survival' as const,
  unit,
  labels: ['A'],
  counts: [1],
  overallStats: { pValue: 0.5 },
  survivalData: [
    {
      meta: {},
      donors: [
        {
          time: 365.25,
          id: 'x',
          submitter_id: 'x',
          project_id: 'p',
          survivalEstimate: 1,
          censored: false,
        },
      ],
    },
  ],
});

describe('toSurvivalPlotData', () => {
  it('converts days to years', () => {
    expect(toSurvivalPlotData(plot('days')).survivalData[0].donors[0].time).toBe(1);
  });

  it('keeps overallStats', () => {
    expect(toSurvivalPlotData(plot('days')).overallStats).toEqual({ pValue: 0.5 });
  });

  it('does not change its input', () => {
    const input = plot('days');
    toSurvivalPlotData(input);
    expect(input.survivalData[0].donors[0].time).toBe(365.25);
  });

  it('does not convert other units', () => {
    expect(toSurvivalPlotData(plot('years')).survivalData[0].donors[0].time).toBe(365.25);
  });
});
