import React from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';

export type ToolStatus = 'Running' | 'Done' | 'Failed';

const parseResult = (result: unknown): unknown => {
  if (typeof result !== 'string') return result;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
};

/** Tools return { ok: false, summary } for a failure they can explain, rather than raising. */
export const toolFailure = (result: unknown): string | undefined => {
  const parsed = parseResult(result) as { ok?: unknown; summary?: unknown } | null | undefined;
  if (parsed === null || typeof parsed !== 'object' || parsed.ok !== false) return undefined;
  return typeof parsed.summary === 'string' ? parsed.summary : 'The tool reported a failure.';
};

export const toolStatus = (isError?: boolean, result?: unknown): ToolStatus => {
  if (isError || toolFailure(result)) return 'Failed';
  return result === undefined ? 'Running' : 'Done';
};

export const toolError = (result: unknown) =>
  (result as { error?: string } | undefined)?.error;

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
}

/** One tool call in the conversation: what ran, on what, and how it ended. */
export const ToolRow: React.FC<ToolRowProps> = ({
  title,
  detail,
  status,
  message,
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
  </div>
);

const ToolCallFallback: ToolCallMessagePartComponent = ({
  toolName,
  result,
  isError,
}) => (
  <ToolRow
    title={displayToolName(toolName)}
    status={toolStatus(isError, result)}
    message={isError ? toolError(result) : toolFailure(result)}
  />
);

export default ToolCallFallback;
