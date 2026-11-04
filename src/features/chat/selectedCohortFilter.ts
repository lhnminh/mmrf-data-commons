import type { CoreState } from '@gen3/core';
import { selectIndexFilters } from '@gen3/core';
import { COHORT_FILTER_INDEX } from '@/core/constants';
import { buildCohortGqlOperator } from '@/core/utils';

/** The store's own object for the selected cohort's filters, safe to subscribe to. */
export const selectSelectedCohortFilterSet = (state: CoreState) =>
  selectIndexFilters(state, COHORT_FILTER_INDEX);

/** The selected cohort as a GQL filter, or undefined when it has no filters. */
export const selectSelectedCohortFilter = (state: CoreState) =>
  buildCohortGqlOperator(selectSelectedCohortFilterSet(state));
