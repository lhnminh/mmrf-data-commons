import React from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';

export type ToolStatus = 'Running' | 'Done' | 'Failed';

type PartStatus = { readonly type: string; readonly reason?: string };

/** The runtime can hand a result over as JSON text or as the parsed object. */
export const parseResult = (result: unknown): unknown => {
  if (typeof result !== 'string') return result;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
};

const resultFields = (result: unknown) => {
  const parsed = parseResult(result);
  return parsed !== null && typeof parsed === 'object'
    ? (parsed as { status?: unknown; summary?: unknown; error?: unknown })
    : {};
};

const textOf = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** Tools return { status: "error", summary } for a failure they can explain. Other statuses are outcomes. */
export const toolFailure = (result: unknown): string | undefined => {
  const { status, summary } = resultFields(result);
  if (status !== 'error') return undefined;
  return textOf(summary) ?? 'The tool reported a failure.';
};

export const toolStatus = (isError?: boolean, result?: unknown, part?: PartStatus): ToolStatus => {
  if (isError || toolFailure(result)) return 'Failed';
  if (result !== undefined) return 'Done';
  return part?.type === 'incomplete' ? 'Failed' : 'Running';
};

/** What to say under a tool's row: why it failed, or its summary. */
export const toolMessage = (isError?: boolean, result?: unknown, part?: PartStatus) => {
  const { summary, error } = resultFields(result);
  if (isError) return textOf(error) ?? textOf(summary);
  if (result === undefined) return part?.type === 'incomplete' ? 'This step did not finish.' : undefined;
  return toolFailure(result) ?? textOf(summary);
};

/** Gateway names tools <target>___<tool>; people only need the tool. */
export const displayToolName = (toolName: string) => {
  const separator = toolName.indexOf('___');
  return separator < 0 ? toolName : toolName.slice(separator + 3);
};

export const CHAT_BUTTON =
  'rounded border border-secondary px-2 py-0.5 font-content text-xs font-semibold hover:bg-base-lightest disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const settingEntries = (settings: unknown): ReadonlyArray<[string, string]> =>
  settings !== null && typeof settings === 'object'
    ? Object.entries(settings).map(([name, value]) => [
        name,
        typeof value === 'string' ? value : JSON.stringify(value),
      ])
    : [];

interface ToolRowProps {
  readonly title: string;
  readonly detail?: string;
  readonly status: ToolStatus;
  readonly message?: string;
  /** The tool's input, shown when the step is expanded. */
  readonly settings?: unknown;
  readonly children?: React.ReactNode;
}

/** One tool call in the conversation: what ran, on what, and how it ended. Expands to its settings and any error. */
export const ToolRow: React.FC<ToolRowProps> = ({
  title,
  detail,
  status,
  message,
  settings,
  children,
}: ToolRowProps) => {
  const entries = settingEntries(settings);
  const isFailed = status === 'Failed';
  const failure = isFailed ? message : undefined;
  return (
    <div className="rounded border border-base-lighter px-2.5 py-1.5 font-content text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading font-semibold">{title}</span>
        {detail && <span className="min-w-0 break-words">{detail}</span>}
        <span
          className={`ml-auto font-semibold ${status === 'Failed' ? 'text-utility-error' : ''}`}
        >
          {status}
        </span>
      </div>
      {message && !isFailed && <p className="mt-1 break-words">{message}</p>}
      {(failure || entries.length > 0) && (
        <details open={isFailed} className="mt-1">
          <summary className="cursor-pointer">Details</summary>
          {failure && <p className="mt-1 break-words">{failure}</p>}
          {entries.map(([name, value]) => (
            <p key={name} className="mt-1 break-all">
              <span className="font-semibold">{name}:</span> {value}
            </p>
          ))}
        </details>
      )}
      {children}
    </div>
  );
};

const ToolCallFallback: ToolCallMessagePartComponent = ({
  toolName,
  args,
  result,
  isError,
  status,
}) => (
  <ToolRow
    title={displayToolName(toolName)}
    status={toolStatus(isError, result, status)}
    message={toolMessage(isError, result, status)}
    settings={args}
  />
);

export default ToolCallFallback;
