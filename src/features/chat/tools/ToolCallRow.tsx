import React from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';

export type ToolStatus = 'Running' | 'Done' | 'Failed';

export const toolStatus = (isError?: boolean, result?: unknown): ToolStatus => {
  if (isError) return 'Failed';
  return result === undefined ? 'Running' : 'Done';
};

export const toolError = (result: unknown) =>
  (result as { error?: string } | undefined)?.error;

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
    title={toolName}
    status={toolStatus(isError, result)}
    message={isError ? toolError(result) : undefined}
  />
);

export default ToolCallFallback;
