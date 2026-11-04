import {
  removeCohortFilter,
  setCohortFilter,
  trimFirstfieldNameToLabel,
  updateCohortFilter,
  type FilterSet,
  type Operation,
} from '@gen3/core';
import isEqual from 'lodash/isEqual';
import { CASE_ID_FIELD, COHORT_FILTER_INDEX } from '@/core/constants';
import { buildCohortGqlOperator } from '@/core/utils';

/** One resolved change from update_cohort. `field` is the Gen3 name. */
export interface CohortChange {
  readonly field: string;
  readonly label?: string;
  readonly values?: ReadonlyArray<string>;
  readonly op: 'set' | 'remove';
}

/** `state.cohort`, in both directions. A snapshot with a new revision also has `changes`. */
export interface CohortState {
  readonly filter?: object | null;
  readonly label?: string;
  readonly caseCount?: number;
  readonly revision: number;
  readonly changedOutsideChat?: boolean;
  readonly changes?: ReadonlyArray<CohortChange>;
}

/** The changes to apply for a snapshot, or null if its revision has already been handled. */
export const planApply = (
  applied: number,
  incoming: CohortState | undefined,
): ReadonlyArray<CohortChange> | null => {
  if (typeof incoming?.revision !== 'number' || incoming.revision <= applied) return null;
  return incoming.changes ?? [];
};

/** The platform's actions for these changes, built as Cohort Builder builds them. */
export const changeActions = (changes: ReadonlyArray<CohortChange>, index: string) =>
  changes.map(({ field, op, values }) =>
    op === 'remove'
      ? removeCohortFilter({ index, field })
      : updateCohortFilter({
          index,
          field,
          filter: { operator: 'in', field, operands: [...(values ?? [])] },
        }),
  );

const isCaseIdField = (field: string) =>
  field === CASE_ID_FIELD || field.endsWith(`.${CASE_ID_FIELD}`);

/** Labels the platform's title-casing gets wrong. They match the agent's field catalog. */
const ACRONYM_LABELS: Record<string, string> = {
  'cgs risk category': 'CGS Risk Category',
  'cgs risk criteria': 'CGS Risk Criteria',
  'iss stage': 'ISS Stage',
  'bmi at diagnosis': 'BMI at Diagnosis',
  'mm bone lesion femur': 'MM Bone Lesion Femur',
  'mm bone lesion pelvis': 'MM Bone Lesion Pelvis',
  'mm bone lesion ribs': 'MM Bone Lesion Ribs',
  'mm bone lesion skull': 'MM Bone Lesion Skull',
  'mm bone lesion spine': 'MM Bone Lesion Spine',
  'censor os': 'Censor OS',
  'censor pfs': 'Censor PFS',
  'survival time os': 'Survival Time OS',
  'survival time pfs': 'Survival Time PFS',
  'project id': 'Project ID',
};

const fieldLabel = (field: string) => {
  const label = trimFirstfieldNameToLabel(field, true);
  return ACRONYM_LABELS[label.toLowerCase()] ?? label;
};

const describeOperation = (field: string, operation: Operation) => {
  const name = fieldLabel(field);
  const { operands } = operation as { operands?: unknown };
  const plain =
    Array.isArray(operands) && operands.every((value) => ['string', 'number'].includes(typeof value));
  return plain ? `${name}: ${(operands as unknown[]).join(', ')}` : name;
};

/** One label per filter. Case IDs are never listed. */
export const cohortFilterLabels = (filterSet: FilterSet): ReadonlyArray<string> => {
  const entries = Object.entries(filterSet.root);
  const named = entries
    .filter(([field]) => !isCaseIdField(field))
    .map(([field, operation]) => describeOperation(field, operation));
  return named.length < entries.length ? ['Selected cases', ...named] : named;
};

/** The cohort's name, as the agent's tools write it. */
export const cohortLabel = (filterSet: FilterSet): string => {
  const labels = cohortFilterLabels(filterSet);
  return labels.length > 0 ? labels.join('; ') : 'All cases';
};

interface HistoryEntry {
  readonly filter: object | null;
  readonly filterSet: FilterSet;
}

/** A cohort with no filters. A chart given this doesn't fall back to the selected cohort. */
const NO_FILTERS = { and: [] };

/** What the cohort was at each revision. */
export class CohortHistory {
  private readonly entries = new Map<number, HistoryEntry>();

  private revisions() {
    return [...this.entries.keys()].sort((a, b) => a - b);
  }

  record(revision: number, filter: object | null, filterSet: FilterSet): void {
    this.entries.set(revision, { filter, filterSet });
  }

  /** The filter at a revision, or undefined if it's not known yet. */
  filterFor(revision: number): object | undefined {
    const entry = this.entries.get(revision);
    return entry && (entry.filter ?? NO_FILTERS);
  }

  /** The filters from just before a revision, only while it's the latest one. */
  undoTarget(revision: number): FilterSet | undefined {
    const revisions = this.revisions();
    if (revisions.at(-1) !== revision) return undefined;
    const previous = revisions.at(-2);
    return previous === undefined ? undefined : this.entries.get(previous)?.filterSet;
  }
}

interface CohortStore {
  readonly getFilterSet: () => FilterSet;
  readonly dispatch: (action: ReturnType<typeof changeActions>[number] | ReturnType<typeof setCohortFilter>) => unknown;
}

/**
 * Keeps the selected cohort and the agent's view of it in step.
 *
 * `revision` is what goes out next. `applied` is the highest revision already reflected in
 * the store, so a snapshot only changes anything when it's above that. The two differ when
 * a manual change raises `revision` during a run: the run's own snapshot can then carry the
 * same number, and it still has to be applied.
 */
export class CohortSync {
  private readonly history = new CohortHistory();
  private readonly undone = new Set<number>();
  private readonly listeners = new Set<() => void>();
  private revision = 1;
  private applied = 1;
  private changedOutsideChat = false;
  private changedDuringRun = false;
  private applying = false;
  private known: FilterSet;
  private version = 0;

  constructor(private readonly store: CohortStore) {
    this.known = store.getFilterSet();
    this.history.record(this.revision, this.currentFilter(), this.known);
  }

  private currentFilter() {
    return (buildCohortGqlOperator(this.known) as object | undefined) ?? null;
  }

  private notify() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  /** Runs the sync's own store updates, so storeChanged can't take them for manual ones. */
  private applyToStore(update: () => void) {
    this.applying = true;
    try {
      update();
    } finally {
      this.applying = false;
    }
    this.known = this.store.getFilterSet();
  }

  private raiseRevision() {
    this.revision = Math.max(this.revision, this.applied) + 1;
    this.history.record(this.revision, this.currentFilter(), this.known);
  }

  /** `state.cohort` for the next run. */
  outgoing(caseCount?: number): CohortState {
    return {
      filter: this.currentFilter(),
      label: cohortLabel(this.known),
      ...(caseCount === undefined ? {} : { caseCount }),
      revision: this.revision,
      changedOutsideChat: this.changedOutsideChat,
    };
  }

  /** A run has started with this state. */
  runStarted(sent: CohortState | undefined): void {
    if (typeof sent?.revision === 'number') {
      this.applied = Math.max(this.applied, sent.revision);
      if (sent.changedOutsideChat) this.changedOutsideChat = false;
    }
    this.changedDuringRun = false;
    this.notify();
  }

  /** A STATE_SNAPSHOT's cohort. Replays and echoes do nothing. */
  snapshot(incoming: CohortState | undefined): void {
    const changes = planApply(this.applied, incoming);
    if (changes === null || incoming === undefined) return;
    this.applied = incoming.revision;
    this.applyToStore(() =>
      changeActions(changes, COHORT_FILTER_INDEX).forEach((action) => this.store.dispatch(action)),
    );
    const filter = incoming.filter === undefined ? this.currentFilter() : incoming.filter;
    this.history.record(incoming.revision, filter, this.known);
    if (this.changedDuringRun) {
      // The store now holds more than this revision's filter, so it needs a revision of its own.
      this.changedOutsideChat = true;
      this.raiseRevision();
    } else {
      this.revision = incoming.revision;
    }
    this.notify();
  }

  /** Call when the store changes. Returns whether that was a manual change to the cohort. */
  storeChanged(): boolean {
    if (this.applying) return false;
    const current = this.store.getFilterSet();
    if (current === this.known) return false;
    const same = isEqual(current, this.known);
    this.known = current;
    if (same) return false;
    this.changedOutsideChat = true;
    this.changedDuringRun = true;
    this.raiseRevision();
    this.notify();
    return true;
  }

  canUndo(revision: number): boolean {
    return !this.undone.has(revision) && this.history.undoTarget(revision) !== undefined;
  }

  isUndone(revision: number): boolean {
    return this.undone.has(revision);
  }

  /** Restores the cohort from before this revision. Returns whether it did. */
  undo(revision: number): boolean {
    const target = this.canUndo(revision) ? this.history.undoTarget(revision) : undefined;
    if (target === undefined) return false;
    this.applyToStore(() =>
      this.store.dispatch(setCohortFilter({ index: COHORT_FILTER_INDEX, filters: target })),
    );
    this.undone.add(revision);
    this.raiseRevision();
    this.notify();
    return true;
  }

  filterFor(revision: number): object | undefined {
    return this.history.filterFor(revision);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;
}
