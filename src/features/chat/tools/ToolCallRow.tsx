import React from 'react';
import { ThreadPrimitive, type ToolCallMessagePartComponent } from '@assistant-ui/react';

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
  'rounded-full border border-primary bg-base-max px-3 py-1 font-heading text-xs font-semibold text-primary hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface ToolSuggestionProps {
  readonly prompt: string;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}

/**
 * A button in a tool's output that sends a follow-up message. Inside a message the composer
 * is that message's edit composer, which isn't open, so clearing it after sending throws.
 */
export const ToolSuggestion: React.FC<ToolSuggestionProps> = ({ prompt, disabled, children }) => (
  <ThreadPrimitive.Suggestion
    prompt={prompt}
    send
    clearComposer={false}
    disabled={disabled}
    className={CHAT_BUTTON}
  >
    {children}
  </ThreadPrimitive.Suggestion>
);

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
  /** Identifies this step to anything that refers to it. */
  readonly toolCallId?: string;
  readonly children?: React.ReactNode;
}

const STEP_DOT: Record<ToolStatus, string> = {
  Running: 'border-2 border-primary bg-base-max motion-safe:animate-pulse',
  Done: 'bg-primary',
  Failed: 'bg-rust',
};

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
    <div
      data-tool-step
      // A line joins this step to the one before it, when nothing sits between them.
      className="relative rounded-md py-1.5 pl-6 pr-2.5 font-content text-[13px] [[data-tool-step]+&]:before:absolute [[data-tool-step]+&]:before:-top-2 [[data-tool-step]+&]:before:bottom-[calc(100%-13px)] [[data-tool-step]+&]:before:left-[8.5px] [[data-tool-step]+&]:before:w-px [[data-tool-step]+&]:before:bg-base-lighter [[data-tool-step]+&]:before:content-['']"
    >
      <span aria-hidden="true" className={`absolute left-1 top-[13px] h-2.5 w-2.5 rounded-full ${STEP_DOT[status]}`} />
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-heading font-semibold text-gunmetal">{title}</span>
        {detail && <span className="min-w-0 break-words">{detail}</span>}
        <span
          className={
            status === 'Done' ? 'sr-only' : `font-semibold ${isFailed ? 'text-rust' : 'text-gunmetal'}`
          }
        >
          {status}
        </span>
      </div>
      {message && !isFailed && <p className="mt-1 break-words">{message}</p>}
      {children}
      {(failure || entries.length > 0) && (
        <details open={isFailed} className="mt-1 text-xs">
          <summary className="w-max cursor-pointer">Inputs</summary>
          {failure && <p className="mt-1 break-words">{failure}</p>}
          {entries.map(([name, value]) => (
            <p key={name} className="mt-1 break-all font-mono">
              <span className="font-semibold">{name}:</span> {value}
            </p>
          ))}
        </details>
      )}
    </div>
  );
};

const ToolCallFallback: ToolCallMessagePartComponent = ({
  toolCallId,
  toolName,
  args,
  result,
  isError,
  status,
}) => (
  <ToolRow
    toolCallId={toolCallId}
    title={displayToolName(toolName)}
    status={toolStatus(isError, result, status)}
    message={toolMessage(isError, result, status)}
    settings={args}
  />
);

export default ToolCallFallback;
