import type { Page } from '@playwright/test';

const INDEX = 'case_centric';

/**
 * Chat's page has no control for adding a filter, and Cohort Builder is a separate app that
 * would unmount Chat. So tests change the cohort as a dropdown does, with the same action on
 * the same store, which they find through the React tree. No test hook ships in the app.
 */
const withStore = <T,>(page: Page, script: string, arg?: unknown) =>
  page.evaluate(
    ({ script: body, arg: value }) => {
      type Fiber = { memoizedProps?: { store?: unknown }; child?: Fiber; sibling?: Fiber };
      type Store = { getState: () => { cohorts?: unknown }; dispatch: (action: unknown) => unknown };
      const root = document.getElementById('__next') as unknown as Record<string, Fiber>;
      const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$')) as string;
      const pending: Fiber[] = [root[key]];
      let store: Store | undefined;
      while (pending.length > 0 && !store) {
        const fiber = pending.pop() as Fiber;
        const candidate = fiber.memoizedProps?.store as Store | undefined;
        if (candidate?.getState && candidate.getState().cohorts) store = candidate;
        if (fiber.sibling) pending.push(fiber.sibling);
        if (fiber.child) pending.push(fiber.child);
      }
      if (!store) throw new Error('The core store is not on the page');
      return new Function('store', 'arg', body)(store, value);
    },
    { script, arg },
  ) as Promise<T>;

const DISPATCH = 'store.dispatch(arg);';

export const addFilter = (page: Page, field: string, values: string[]) =>
  withStore(page, DISPATCH, {
    type: 'cohort/updateCohortFilter',
    payload: { index: INDEX, field, filter: { operator: 'in', field, operands: values } },
  });

/** The fields the selected cohort filters on, sorted. */
export const filterFields = (page: Page) =>
  withStore<string[]>(
    page,
    `const { cohortManager: c } = store.getState().cohorts;
     const filters = c.entities[c.currentCohortId].filters[arg];
     return Object.keys(filters?.root ?? {}).sort();`,
    INDEX,
  );
