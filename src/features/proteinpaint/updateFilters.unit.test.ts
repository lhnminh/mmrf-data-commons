import { modals } from '@mantine/modals';
import { updateFilters } from './updateFilters';

jest.mock('@mantine/modals', () => ({modals: {openContextModal: jest.fn()}}));

beforeEach(() => jest.clearAllMocks());

test('sample attribute mappings produce distinct scalar case IDs in the saved cohort', () => {
  const samples = [
    {'cases.case_id': 'CASE-001'},
    {'cases.case_id': 'CASE-002'},
    {'cases.case_id': 'CASE-001'},
    {'cases.case_id': ''},
    {} as {'cases.case_id': string},
  ];
  const before = structuredClone(samples);
  updateFilters({samples, source: 'KRAS'});
  expect(modals.openContextModal).toHaveBeenCalledTimes(1);
  expect(modals.openContextModal).toHaveBeenCalledWith(expect.objectContaining({
    modal: 'saveCohortModalMMRF',
    innerProps: {filters: {case_centric: {mode: 'and', root: {
      case_id: {field: 'case_id', operands: ['CASE-001', 'CASE-002'], operator: 'in'},
    }}}},
  }));
  expect(samples).toEqual(before);
});

test('an empty or unmapped sample selection does not create a cohort', () => {
  updateFilters({samples: [], source: 'KRAS'});
  updateFilters({samples: [{} as {'cases.case_id': string}], source: 'KRAS'});
  expect(modals.openContextModal).not.toHaveBeenCalled();
});
