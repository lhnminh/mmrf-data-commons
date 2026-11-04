import type { FilterSet } from '@gen3/core';
import type { SelectSamples, SelectSamplesCallback } from './sjpp-types';

export interface Mds3Arg {
  dslabel?: string;
  genome?: string;
  holder?: HTMLElement;
  noheader?: boolean;
  nobox?: boolean;
  hide_dsHandles?: boolean;
  host: string;
  filter0?: FilterSet;
  launchGdcCorrelation?: boolean;
  /** Plots to open straight away. Without it, ProteinPaint shows its Correlation Input panel. */
  state?: { plots: ReadonlyArray<object> };
  opts: CorrelationArgOpts;
}

interface CorrelationArgOpts {
  barchart: {
    allow2selectSamples: SelectSamples;
  };
  violin: {
    allow2selectSamples: SelectSamples;
  };
  boxplot: {
    allow2selectSamples: SelectSamples;
  };
}

export function getCorrelationTrack(
  basepath: string,
  callback: SelectSamplesCallback,
  filter0: any,
  plots?: ReadonlyArray<object>,
) {
  const allow2selectSamples = {
    buttonText: 'Create cohort',
    attributes: [
      {
        from: 'sample',
        to: 'cases.case_id',
        convert: true,
      },
    ],
    callback,
  };

  const arg: Mds3Arg = {
    dslabel: 'MMRF',
    genome: 'hg38',
    // host in gdc is just a relative url path,
    // using the same domain as the GDC portal where PP is embedded
    host: basepath,
    launchGdcCorrelation: true,
    filter0,
    ...(plots ? { state: { plots } } : {}),
    opts: {
      barchart: {
        allow2selectSamples,
      },
      violin: {
        allow2selectSamples,
      },
      boxplot: {
        allow2selectSamples,
      },
    },
  };

  return arg;
}
