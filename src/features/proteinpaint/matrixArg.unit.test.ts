import { getMatrixTrack } from './matrixArg';

describe('getMatrixTrack', () => {
  it('keeps the start screen and the 1000 default on the page', () => {
    const arg = getMatrixTrack({ chartType: 'hierCluster' }, '/pp');

    expect(arg.launchGdcHierCluster).toBe(true);
    expect(arg.opts.geneset).toEqual({ showEditUI: true });
    expect(arg.settings).not.toHaveProperty('hierCluster');
  });

  it('generates the top genes straight away in chat', () => {
    const arg = getMatrixTrack({ chartType: 'hierCluster', maxGenes: 20, generateTopGenes: true }, '/pp');

    expect(arg.opts.geneset).toEqual({ showEditUI: false });
    expect(arg.settings.hierCluster).toEqual({ maxGenes: 20 });
  });

  it('leaves OncoMatrix as it was', () => {
    const arg = getMatrixTrack({ chartType: 'matrix' }, '/pp');

    expect(arg.launchGdcMatrix).toBe(true);
    expect(arg.settings).toEqual({ matrix: { maxGenes: 50 } });
    expect(arg.opts).not.toHaveProperty('geneset');
  });

  it('gives OncoMatrix the genes it asks for', () => {
    expect(getMatrixTrack({ chartType: 'matrix', maxGenes: 3 }, '/pp').settings.matrix).toEqual({ maxGenes: 3 });
  });

  it('passes a gene list through', () => {
    const arg = getMatrixTrack({ chartType: 'hierCluster', genes: ['DUSP4'], generateTopGenes: true }, '/pp');

    expect(arg.genes).toEqual(['DUSP4']);
    expect(arg.opts.geneset).toEqual({ showEditUI: false });
    expect(arg.settings).not.toHaveProperty('hierCluster');
  });

  it('leaves genes out without a list', () => {
    expect(getMatrixTrack({ chartType: 'hierCluster' }, '/pp')).not.toHaveProperty('genes');
    expect(getMatrixTrack({ chartType: 'matrix' }, '/pp')).not.toHaveProperty('genes');
  });

  it('prefers the chart own basepath', () => {
    expect(getMatrixTrack({ chartType: 'matrix', basepath: '/own' }, '/pp').host).toBe('/own');
    expect(getMatrixTrack({ chartType: 'matrix' }, '/pp').host).toBe('/pp');
  });
});
