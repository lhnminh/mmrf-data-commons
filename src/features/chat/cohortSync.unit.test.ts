import type { FilterSet } from '@gen3/core';
import {
  CohortHistory,
  CohortSync,
  changeActions,
  cohortLabel,
  planApply,
  type CohortChange,
  type CohortState,
} from './cohortSync';

const INDEX = 'case_centric';
const RACE: CohortChange = { field: 'demographic.race', label: 'Race', values: ['black or african american'], op: 'set' };
const raceOp = { operator: 'in', field: 'demographic.race', operands: ['black or african american'] } as const;
const genderOp = { operator: 'in', field: 'demographic.gender', operands: ['female'] } as const;
const set = (root: object): FilterSet => ({ mode: 'and', root }) as unknown as FilterSet;
const NONE = set({});
const RACE_SET = set({ 'demographic.race': raceOp });
const RACE_FILTER = { and: [{ in: { 'demographic.race': ['black or african american'] } }] };

describe('planApply', () => {
  it('applies a newer revision once', () => {
    const incoming = { revision: 2, changes: [RACE] } as CohortState;
    expect(planApply(1, incoming)).toEqual([RACE]);
    expect(planApply(2, incoming)).toBeNull();
  });

  it('ignores a replayed or older revision', () => {
    expect(planApply(3, { revision: 2, changes: [RACE] } as CohortState)).toBeNull();
  });

  it('ignores a snapshot with no cohort or no usable revision', () => {
    expect(planApply(1, undefined)).toBeNull();
    expect(planApply(1, { revision: 'two' } as unknown as CohortState)).toBeNull();
  });

  it('has nothing to apply for a newer revision with no changes', () => {
    expect(planApply(1, { revision: 2 } as CohortState)).toEqual([]);
  });
});

describe('changeActions', () => {
  it('touches only the changed fields', () => {
    const actions = changeActions(
      [RACE, { field: 'demographic.ethnicity', op: 'remove' }],
      INDEX,
    );
    expect(actions).toEqual([
      {
        type: 'cohort/updateCohortFilter',
        payload: { index: INDEX, field: 'demographic.race', filter: raceOp },
      },
      {
        type: 'cohort/removeCohortFilter',
        payload: { index: INDEX, field: 'demographic.ethnicity' },
      },
    ]);
  });
});

describe('CohortHistory', () => {
  it('keeps a filter for each revision', () => {
    const history = new CohortHistory();
    history.record(1, null, NONE);
    history.record(2, RACE_FILTER, RACE_SET);
    expect(history.filterFor(2)).toEqual(RACE_FILTER);
    expect(history.filterFor(9)).toBeUndefined();
  });

  it('gives a revision with no filters an empty filter, not "unknown"', () => {
    const history = new CohortHistory();
    history.record(1, null, NONE);
    expect(history.filterFor(1)).toEqual({ and: [] });
  });

  it('offers no undo target after a manual edit', () => {
    const history = new CohortHistory();
    history.record(1, null, NONE);
    history.record(2, RACE_FILTER, RACE_SET);
    history.record(3, null, NONE);
    expect(history.undoTarget(2)).toBeUndefined();
  });

  it('offers an undo target only for the latest change', () => {
    const history = new CohortHistory();
    history.record(1, null, NONE);
    history.record(2, RACE_FILTER, RACE_SET);
    expect(history.undoTarget(2)).toBe(NONE);
    expect(history.undoTarget(1)).toBeUndefined();
  });

  it('has no undo target for a revision it never saw', () => {
    const history = new CohortHistory();
    history.record(1, null, NONE);
    expect(history.undoTarget(2)).toBeUndefined();
  });
});

describe('cohortLabel', () => {
  it('names a cohort with no filters', () => {
    expect(cohortLabel(NONE)).toBe('All cases');
  });

  // "Sex" and "Age at Index" are the platform's own labels, as the filter panel shows them.
  it('lists each field with its values', () => {
    expect(cohortLabel(set({ 'demographic.race': raceOp, 'demographic.gender': genderOp }))).toBe(
      'Race: black or african american; Sex: female',
    );
  });

  it('writes acronym fields as the agent does', () => {
    const op = (field: string) => ({ operator: 'in' as const, field, operands: ['I'] });
    expect(
      cohortLabel(
        set({
          'diagnoses.iss_stage': op('diagnoses.iss_stage'),
          'cgs_risk_key_criteria.cgs_risk_category': op('cgs_risk_key_criteria.cgs_risk_category'),
        }),
      ),
    ).toBe('ISS Stage: I; CGS Risk Category: I');
  });

  it('never lists case IDs', () => {
    const label = cohortLabel(
      set({ case_id: { operator: 'in', field: 'case_id', operands: ['SYNTH-1'] }, 'demographic.gender': genderOp }),
    );
    expect(label).toBe('Selected cases; Sex: female');
  });

  it('names a field whose filter has no plain values, without its contents', () => {
    expect(
      cohortLabel(set({ 'demographic.age_at_index': { operator: '>=', field: 'demographic.age_at_index', operand: 40 } })),
    ).toBe('Age at Index');
  });
});

describe('CohortSync', () => {
  /** A store as small as the platform's: the two change actions, and a set that replaces all. */
  const makeSync = (initial: FilterSet = NONE) => {
    let current = initial;
    let onChange = () => {};
    const dispatch = (action: { type: string; payload: Record<string, never> }) => {
      const root = { ...(current.root as Record<string, unknown>) };
      if (action.type === 'cohort/updateCohortFilter') root[action.payload.field] = action.payload.filter;
      if (action.type === 'cohort/removeCohortFilter') delete root[action.payload.field];
      current = action.type === 'cohort/setCohortFilter' ? action.payload.filters : set(root);
      onChange();
    };
    const sync = new CohortSync({ getFilterSet: () => current, dispatch: dispatch as never });
    onChange = () => sync.storeChanged();
    const manual = (field: string, op: object) =>
      dispatch({ type: 'cohort/updateCohortFilter', payload: { field, filter: op } as never });
    const manualRemove = (field: string) =>
      dispatch({ type: 'cohort/removeCohortFilter', payload: { field } as never });
    return { sync, manual, manualRemove, filters: () => Object.keys(current.root) };
  };
  const raceSnapshot = (revision = 2): CohortState => ({ filter: RACE_FILTER, revision, changes: [RACE] });

  it('starts at revision 1, unflagged, with no filter', () => {
    const { sync } = makeSync();
    expect(sync.outgoing()).toEqual({ filter: null, label: 'All cases', revision: 1, changedOutsideChat: false });
  });

  it('sends the case count only when it has one', () => {
    const { sync } = makeSync();
    expect(sync.outgoing(1000).caseCount).toBe(1000);
    expect('caseCount' in sync.outgoing(undefined)).toBe(false);
  });

  it('adopts a snapshot revision without treating it as a manual change', () => {
    const { sync, filters } = makeSync();
    sync.runStarted(sync.outgoing());
    sync.snapshot(raceSnapshot());
    expect(filters()).toEqual(['demographic.race']);
    expect(sync.outgoing()).toMatchObject({ revision: 2, changedOutsideChat: false, label: 'Race: black or african american' });
  });

  it('flags a manual change and raises the revision', () => {
    const { sync, manual } = makeSync();
    manual('demographic.gender', genderOp);
    expect(sync.outgoing()).toMatchObject({ revision: 2, changedOutsideChat: true });
  });

  it('ignores a store update that leaves the filters equal', () => {
    const { sync, manualRemove } = makeSync();
    manualRemove('not-there');
    expect(sync.outgoing()).toMatchObject({ revision: 1, changedOutsideChat: false });
  });

  it('clears the flag once a run starts with it', () => {
    const { sync, manual } = makeSync();
    manual('demographic.gender', genderOp);
    sync.runStarted(sync.outgoing());
    expect(sync.outgoing().changedOutsideChat).toBe(false);
  });

  it('does not reapply a replayed snapshot after a manual removal', () => {
    const { sync, manualRemove, filters } = makeSync();
    sync.runStarted(sync.outgoing());
    sync.snapshot(raceSnapshot());
    manualRemove('demographic.race');
    sync.runStarted(sync.outgoing());
    sync.snapshot(raceSnapshot());
    expect(filters()).toEqual([]);
    expect(sync.outgoing().revision).toBe(3);
  });

  it('does not apply a snapshot at the revision it just sent', () => {
    const { sync, manual, filters } = makeSync();
    manual('demographic.gender', genderOp);
    sync.runStarted(sync.outgoing()); // Sends revision 2, so an old snapshot at 2 is a replay.
    sync.snapshot(raceSnapshot());
    expect(filters()).toEqual(['demographic.gender']);
  });

  it('keeps a manual change made during a run, and still applies the run', () => {
    const { sync, manual, filters } = makeSync();
    sync.runStarted(sync.outgoing());
    manual('demographic.gender', genderOp); // Local revision is now 2, the same as the coming snapshot.
    sync.snapshot(raceSnapshot());
    expect(filters().sort()).toEqual(['demographic.gender', 'demographic.race']);
    expect(sync.outgoing()).toMatchObject({ revision: 3, changedOutsideChat: true });
    // Charts from that tool use the tool's filter, not the merged one.
    expect(sync.filterFor(2)).toEqual(RACE_FILTER);
    expect(sync.canUndo(2)).toBe(false);
  });

  it('keeps the flag on a manual change made during a run for the next run', () => {
    const { sync, manual } = makeSync();
    sync.runStarted(sync.outgoing());
    manual('demographic.gender', genderOp);
    expect(sync.outgoing().changedOutsideChat).toBe(true);
    sync.runStarted(sync.outgoing());
    expect(sync.outgoing().changedOutsideChat).toBe(false);
  });

  it('undoes the latest change without flagging it', () => {
    const { sync, filters } = makeSync();
    sync.runStarted(sync.outgoing());
    sync.snapshot(raceSnapshot());
    expect(sync.canUndo(2)).toBe(true);
    expect(sync.undo(2)).toBe(true);
    expect(filters()).toEqual([]);
    expect(sync.outgoing()).toMatchObject({ revision: 3, changedOutsideChat: false, filter: null });
    expect(sync.isUndone(2)).toBe(true);
  });

  it('undoes only once', () => {
    const { sync } = makeSync();
    sync.runStarted(sync.outgoing());
    sync.snapshot(raceSnapshot());
    sync.undo(2);
    const after = sync.outgoing();
    expect(sync.undo(2)).toBe(false);
    expect(sync.outgoing()).toEqual(after);
  });

  it('offers no undo after a manual edit', () => {
    const { sync, manual } = makeSync();
    sync.runStarted(sync.outgoing());
    sync.snapshot(raceSnapshot());
    manual('demographic.gender', genderOp);
    expect(sync.canUndo(2)).toBe(false);
    expect(sync.undo(2)).toBe(false);
  });

  it('offers no undo before the snapshot arrives', () => {
    const { sync } = makeSync();
    sync.runStarted(sync.outgoing());
    expect(sync.canUndo(2)).toBe(false);
  });

  it('keeps a record for a revision sent to a run with no change', () => {
    const { sync, manual } = makeSync();
    manual('demographic.gender', genderOp);
    expect(sync.filterFor(2)).toEqual({ and: [{ in: { 'demographic.gender': ['female'] } }] });
  });

  it('tells subscribers about each change', () => {
    const { sync } = makeSync();
    const listener = jest.fn();
    const stop = sync.subscribe(listener);
    sync.runStarted(sync.outgoing());
    sync.snapshot(raceSnapshot());
    expect(listener).toHaveBeenCalled();
    stop();
    listener.mockClear();
    sync.undo(2);
    expect(listener).not.toHaveBeenCalled();
  });
});
