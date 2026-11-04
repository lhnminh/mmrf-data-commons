import React from 'react';
import { ThreadPrimitive, useAuiState, type ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useCohortUndo } from '../useCohortSync';
import type { CohortChange } from '../cohortSync';
import { parseResult, toolMessage, toolStatus, ToolRow } from './ToolCallRow';

const TITLE = 'Cohort Builder';
const BUTTON =
  'rounded border border-secondary px-2 py-0.5 font-content text-xs font-semibold hover:bg-base-lightest disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface CohortResult {
  readonly status?: string;
  readonly summary?: string;
  readonly changes?: ReadonlyArray<CohortChange>;
  readonly casesBefore?: number;
  readonly casesAfter?: number;
  readonly cohort?: { readonly revision?: number };
  readonly label?: string;
  readonly options?: ReadonlyArray<string>;
}

const count = (value: number | undefined) => value?.toLocaleString('en-US');

const describeChange = ({ field, label, op, values }: CohortChange) => {
  const name = label ?? field;
  return op === 'remove' ? `${name} removed` : `${name}: ${(values ?? []).join(', ')}`;
};

const Undo: React.FC<{ readonly result: CohortResult }> = ({ result }) => {
  const { canUndo, isUndone, undo } = useCohortUndo(result.cohort?.revision);
  const isRunning = useAuiState((s) => s.thread.isRunning);

  if (isUndone) {
    return (
      <p className="mt-1">
        <span className="font-semibold">Undone</span>
        {result.casesBefore !== undefined && (
          <span className="ml-2">Cohort restored: {count(result.casesBefore)} cases.</span>
        )}
      </p>
    );
  }
  if (!canUndo) return null;
  return (
    <button type="button" className={`${BUTTON} mt-1`} disabled={isRunning} onClick={undo}>
      Undo
    </button>
  );
};

const UpdatedCohort: React.FC<{ readonly result: CohortResult }> = ({ result }) => {
  const mapping = (result.changes ?? []).map(describeChange).join(' · ');
  const hasCounts = result.casesBefore !== undefined && result.casesAfter !== undefined;
  return (
    <ToolRow title={`${TITLE} · Updated cohort`} status="Done">
      <p className="mt-1 break-words">
        {mapping}
        {hasCounts && (
          <>
            {mapping && ' · '}
            {count(result.casesBefore)} → <strong>{count(result.casesAfter)} cases</strong>
          </>
        )}
      </p>
      <Undo result={result} />
    </ToolRow>
  );
};

const AmbiguousCohort: React.FC<{ readonly result: CohortResult }> = ({ result }) => (
  <ToolRow title={`${TITLE} · Which one?`} status="Done" message={result.summary}>
    <div className="mt-1 flex flex-wrap gap-2">
      {(result.options ?? []).map((option) => (
        <ThreadPrimitive.Suggestion
          key={option}
          prompt={`Use ${option} for ${result.label ?? 'that filter'}.`}
          send
          className={BUTTON}
        >
          {option}
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  </ToolRow>
);

const CohortToolUI: ToolCallMessagePartComponent = ({ result, isError, status }) => {
  const rowStatus = toolStatus(isError, result, status);
  if (rowStatus === 'Running') {
    return (
      <div data-testid="cohort-tool-skeleton" className="animate-pulse">
        <ToolRow title={`${TITLE} · Updating cohort`} status="Running" />
      </div>
    );
  }
  if (rowStatus === 'Failed') {
    return (
      <ToolRow
        title={`${TITLE} · Update cohort`}
        status="Failed"
        message={toolMessage(isError, result, status)}
      />
    );
  }
  const parsed = parseResult(result) as CohortResult;
  if (parsed?.status === 'ok') return <UpdatedCohort result={parsed} />;
  if (parsed?.status === 'ambiguous') return <AmbiguousCohort result={parsed} />;
  return (
    <ToolRow
      title={`${TITLE} · Cohort not changed`}
      status="Done"
      message={toolMessage(isError, result, status)}
    />
  );
};

export default CohortToolUI;
