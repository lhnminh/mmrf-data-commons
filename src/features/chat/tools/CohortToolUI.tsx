import React from 'react';
import { ThreadPrimitive, useAuiState, type ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useCohortUndo } from '../useCohortSync';
import type { CohortChange } from '../cohortSync';
import { CHAT_BUTTON as BUTTON, parseResult, toolMessage, toolStatus, ToolRow } from './ToolCallRow';

const TITLE = 'Cohort Builder';

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

const UpdatedCohort: React.FC<{ readonly result: CohortResult; readonly settings: unknown }> = ({ result, settings }) => {
  const mapping = (result.changes ?? []).map(describeChange).join(' · ');
  const hasCounts = result.casesBefore !== undefined && result.casesAfter !== undefined;
  return (
    <ToolRow title={`${TITLE} · Updated cohort`} status="Done" settings={settings}>
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

const AmbiguousCohort: React.FC<{ readonly result: CohortResult; readonly settings: unknown }> = ({ result, settings }) => (
  <ToolRow title={`${TITLE} · Which one?`} status="Done" message={result.summary} settings={settings}>
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

const CohortToolUI: ToolCallMessagePartComponent = ({ args, result, isError, status }) => {
  const rowStatus = toolStatus(isError, result, status);
  if (rowStatus === 'Running') {
    return (
      <div data-testid="cohort-tool-skeleton" className="animate-pulse">
        <ToolRow title={`${TITLE} · Updating cohort`} status="Running" settings={args} />
      </div>
    );
  }
  if (rowStatus === 'Failed') {
    return (
      <ToolRow
        title={`${TITLE} · Update cohort`}
        status="Failed"
        message={toolMessage(isError, result, status)}
        settings={args}
      />
    );
  }
  const parsed = parseResult(result) as CohortResult;
  if (parsed?.status === 'ok') return <UpdatedCohort result={parsed} settings={args} />;
  if (parsed?.status === 'ambiguous') return <AmbiguousCohort result={parsed} settings={args} />;
  return (
    <ToolRow
      title={`${TITLE} · Cohort not changed`}
      status="Done"
      message={toolMessage(isError, result, status)}
      settings={args}
    />
  );
};

export default CohortToolUI;
