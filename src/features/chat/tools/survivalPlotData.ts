import { DAYS_IN_YEAR } from '@/core/constants';
import type { SurvivalPlotData } from '@/core/features/survival/types';
import type { CorrelationPlot } from '../agentResponse';

/** SurvivalPlot expects time in years, while the agent reports days. */
export const toSurvivalPlotData = (plot: CorrelationPlot): SurvivalPlotData => ({
  overallStats: plot.overallStats,
  survivalData:
    plot.unit === 'days'
      ? plot.survivalData.map((curve) => ({
          ...curve,
          donors: curve.donors.map((donor) => ({
            ...donor,
            time: donor.time / DAYS_IN_YEAR,
          })),
        }))
      : plot.survivalData,
});
