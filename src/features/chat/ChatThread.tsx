import React from 'react';
import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from '@assistant-ui/react';
import { SUGGESTED_PROMPTS } from './suggestedPrompts';
import CorrelationPlotTool from './tools/CorrelationPlotTool';
import ToolCallFallback from './tools/ToolCallRow';

const TOOL_DISPLAYS = {
  by_name: { correlation_plot: CorrelationPlotTool },
  Fallback: ToolCallFallback,
};
const ASSISTANT_PARTS = { tools: TOOL_DISPLAYS };

const COLUMN = 'mx-auto w-full max-w-[660px] px-4';
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const EmptyState: React.FC = () => (
  <div className={`${COLUMN} mt-auto`}>
    <h2 className="font-heading text-xl font-bold text-base-contrast-max">
      What do you want to find out?
    </h2>
    <p className="mb-4 mt-1 font-content text-sm text-base-content-dark">
      Compare survival between groups, or ask about research concepts and how
      to use the Virtual Lab.
    </p>
    <div className="flex flex-col gap-2">
      {SUGGESTED_PROMPTS.map((prompt) => (
        <ThreadPrimitive.Suggestion
          key={prompt}
          prompt={prompt}
          send
          className={`rounded-md border border-base-lighter bg-base-max px-3 py-2 text-left font-content text-sm hover:border-secondary ${FOCUS_RING}`}
        >
          {prompt}
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  </div>
);

const UserMessage: React.FC = () => (
  <MessagePrimitive.Root className={`${COLUMN} mt-6 first:mt-0`}>
    <div
      role="heading"
      aria-level={3}
      className="whitespace-pre-wrap break-words font-heading text-base font-bold text-base-contrast-max"
    >
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

const AssistantMessage: React.FC = () => (
  <MessagePrimitive.Root className={`${COLUMN} mt-2`}>
    <div className="break-words border-l-[3px] border-primary pl-3 font-content text-sm">
      <MessagePrimitive.Parts components={ASSISTANT_PARTS} />
    </div>
  </MessagePrimitive.Root>
);

const Composer: React.FC<{ readonly isEmpty: boolean }> = ({ isEmpty }) => (
  <ThreadPrimitive.ViewportFooter
    className={`sticky bottom-0 bg-base-max pb-3 pt-3 ${isEmpty ? 'mb-auto' : 'mt-auto'}`}
  >
    <div className={COLUMN}>
      <ComposerPrimitive.Root className="flex items-end gap-2 rounded-md border border-secondary bg-base-max p-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
        <ComposerPrimitive.Input
          rows={1}
          placeholder="Ask about your cohort"
          aria-label="Ask about your cohort"
          className="max-h-32 min-w-0 flex-1 resize-none border-0 bg-transparent p-1 font-content text-sm outline-none focus:ring-0"
        />
        <ComposerPrimitive.Send
          className={`rounded bg-secondary px-3 py-1 font-content text-sm font-semibold text-white hover:bg-secondary-darker disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          Send
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
      <p className="mt-1.5 font-content text-xs text-base-content-dark">
        Chat can&apos;t use your selected cohort yet, so comparisons cover all cases.
      </p>
    </div>
  </ThreadPrimitive.ViewportFooter>
);

const ChatThread: React.FC = () => {
  const isEmpty = useAuiState((s) => s.thread.isEmpty);

  return (
    // 460px is roughly the page chrome above the tool area, so the message box stays on screen.
    <ThreadPrimitive.Root className="flex h-[calc(100vh-460px)] min-h-[480px] flex-col bg-base-max">
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        scrollToBottomOnInitialize={false}
        className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden pt-6"
      >
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <EmptyState />
        </AuiIf>
        <ThreadPrimitive.Messages>
          {({ message }) =>
            message.role === 'user' ? <UserMessage /> : <AssistantMessage />
          }
        </ThreadPrimitive.Messages>
        <Composer isEmpty={isEmpty} />
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

export default ChatThread;
