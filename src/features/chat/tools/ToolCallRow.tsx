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

interface ToolRowProps {
  readonly title: string;
  readonly detail?: string;
  readonly status: ToolStatus;
  readonly message?: string;
  readonly children?: React.ReactNode;
}

/** One tool call in the conversation: what ran, on what, and how it ended. */
export const ToolRow: React.FC<ToolRowProps> = ({
  title,
  detail,
  status,
  message,
  children,
}: ToolRowProps) => (
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
    {message && <p className="mt-1 break-words">{message}</p>}
    {children}
  </div>
);

const ToolCallFallback: ToolCallMessagePartComponent = ({
  toolName,
  result,
  isError,
  status,
}) => (
  <ToolRow
    title={displayToolName(toolName)}
    status={toolStatus(isError, result, status)}
    message={toolMessage(isError, result, status)}
  />
);

export default ToolCallFallback;
