import { getCorrelationTrack } from './correlationArg';

const callback = jest.fn();

describe('getCorrelationTrack', () => {
  it('leaves the page default alone without plots', () => {
    const arg = getCorrelationTrack('/pp', callback, { and: [] });

    expect(arg.launchGdcCorrelation).toBe(true);
    expect(arg).not.toHaveProperty('state');
  });

  it('passes plots through as state.plots', () => {
    const plots = [{ chartType: 'survival', term: { id: 'overall_survival' } }];

    expect(getCorrelationTrack('/pp', callback, { and: [] }, plots).state).toEqual({ plots });
  });

  it('keeps an empty but real filter', () => {
    expect(getCorrelationTrack('/pp', callback, { and: [] }).filter0).toEqual({ and: [] });
  });

  it('keeps Create cohort on the plots that offer it', () => {
    const { opts } = getCorrelationTrack('/pp', callback, { and: [] });

    expect(opts.barchart.allow2selectSamples.callback).toBe(callback);
    expect(opts.violin.allow2selectSamples.callback).toBe(callback);
    expect(opts.boxplot.allow2selectSamples.callback).toBe(callback);
  });
});
