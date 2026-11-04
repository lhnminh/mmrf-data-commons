import { selectSelectedCohortFilter } from './selectedCohortFilter';

// The shape the store really holds, read from a running session: filters sit under "case_centric".
const stateWith = (filters: object) =>
  ({
    cohorts: {
      availableCohorts: {
        ids: ['current'],
        entities: { current: { id: 'current', filters } },
        currentCohort: 'current',
      },
    },
  }) as never;

jest.mock('@gen3/core', () => ({
  ...jest.requireActual('@gen3/core'),
  selectIndexFilters: (state: never, index: string) =>
    (state as { cohorts: { availableCohorts: { entities: { current: { filters: Record<string, unknown> } } } } })
      .cohorts.availableCohorts.entities.current.filters[index] ?? { mode: 'and', root: {} },
}));

describe('selectSelectedCohortFilter', () => {
  it('reads the filters the page applies to the selected cohort', () => {
    const filter = selectSelectedCohortFilter(
      stateWith({
        case_centric: {
          mode: 'and',
          root: {
            'demographic.gender': {
              operator: 'in',
              field: 'demographic.gender',
              operands: ['female'],
            },
          },
        },
      }),
    );
    expect(JSON.stringify(filter)).toContain('demographic.gender');
    expect(JSON.stringify(filter)).toContain('female');
  });

  it('is undefined when the cohort has no filters', () => {
    expect(selectSelectedCohortFilter(stateWith({}))).toBeUndefined();
  });
});
