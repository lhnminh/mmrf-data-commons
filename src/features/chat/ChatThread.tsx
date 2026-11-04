import React from 'react';
import {
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from '@assistant-ui/react';
import { ChatEvidenceProvider } from './ChatEvidence';
import { chatErrorMessage } from './chatError';
import { SUGGESTED_PROMPTS } from './suggestedPrompts';
import ToolCallFallback from './tools/ToolCallRow';
import MarkdownText from './MarkdownText';

const TOOL_DISPLAYS = {
  Fallback: ToolCallFallback,
};
const ASSISTANT_PARTS = { Text: MarkdownText, tools: TOOL_DISPLAYS };

const COLUMN = 'mx-auto w-full max-w-[1200px] px-5';
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const EmptyState: React.FC = () => (
  <div className="mx-auto mb-7 mt-auto w-full max-w-[760px] px-5">
    <h2 className="font-heading text-[34px] font-semibold leading-tight tracking-tight text-gunmetal">
      What do you want to find out?
    </h2>
    <p className="mb-5 mt-2 font-content text-[15px] text-gunmetal">
      Ask in plain language. Chat uses this cohort, opens the Virtual Lab&apos;s own charts and shows each step it ran.
    </p>
    <div className="divide-y divide-base-lighter border-y border-base-lighter">
      {SUGGESTED_PROMPTS.map(({ prompt, label }) => (
        <ThreadPrimitive.Suggestion
          key={prompt}
          prompt={prompt}
          send
          aria-label={prompt}
          className={`flex w-full items-baseline justify-between gap-3 px-0.5 py-3 text-left font-content text-[15px] font-medium text-gunmetal hover:text-primary ${FOCUS_RING}`}
        >
          <span>{prompt}</span>
          <span aria-hidden="true" className="shrink-0 text-xs font-normal">
            {label}
          </span>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  </div>
);

const UserMessage: React.FC = () => (
  <MessagePrimitive.Root className={`${COLUMN} mt-10 first:mt-0`}>
    <div
      role="heading"
      aria-level={3}
      className="whitespace-pre-wrap break-words font-heading text-2xl font-semibold tracking-tight text-gunmetal"
    >
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

const RunError: React.FC = () => {
  const error = useAuiState((s) =>
    s.message.status?.type === 'incomplete' ? s.message.status.error : undefined,
  );
  return <ErrorPrimitive.Message>{chatErrorMessage(error)}</ErrorPrimitive.Message>;
};

const AssistantMessage: React.FC = () => (
  <MessagePrimitive.Root className={`${COLUMN} mt-2`}>
    <div className="break-words font-content text-[15px] text-gunmetal">
      <MessagePrimitive.Parts components={ASSISTANT_PARTS} />
      <MessagePrimitive.Error>
        <ErrorPrimitive.Root className="mt-1 text-utility-error">
          <RunError />
        </ErrorPrimitive.Root>
      </MessagePrimitive.Error>
    </div>
  </MessagePrimitive.Root>
);

const SEND_BUTTON = `rounded-lg bg-primary px-3.5 py-1.5 font-heading text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;
const STOP_BUTTON = `rounded-lg border border-primary bg-base-max px-3.5 py-1.5 font-heading text-[13px] font-semibold text-primary ${FOCUS_RING}`;

const Composer: React.FC<{ readonly isEmpty: boolean }> = ({ isEmpty }) => (
  <ThreadPrimitive.ViewportFooter
    className={`sticky bottom-0 bg-gradient-to-t from-base-max from-70% to-transparent pb-3.5 pt-3 ${isEmpty ? 'mb-auto' : 'mt-auto'}`}
  >
    <div className={isEmpty ? 'mx-auto w-full max-w-[760px] px-5' : COLUMN}>
      <ComposerPrimitive.Root className="flex items-end gap-2 rounded-xl border border-base-lighter bg-base-max p-2 pl-3.5 shadow-[0_6px_22px_rgba(32,49,59,0.09)] focus-within:border-primary">
        <ComposerPrimitive.Input
          rows={1}
          placeholder={isEmpty ? 'Ask about the Virtual Lab' : 'Ask a follow-up'}
          aria-label="Ask about the Virtual Lab"
          className="max-h-32 min-w-0 flex-1 resize-none border-0 bg-transparent py-1 font-content text-[15px] outline-none focus:ring-0"
        />
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel className={STOP_BUTTON}>Stop</ComposerPrimitive.Cancel>
        </AuiIf>
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send className={SEND_BUTTON}>Send</ComposerPrimitive.Send>
        </AuiIf>
      </ComposerPrimitive.Root>
    </div>
  </ThreadPrimitive.ViewportFooter>
);

const ChatThread: React.FC = () => {
  const isEmpty = useAuiState((s) => s.thread.isEmpty);

  return (
    // 120px is roughly Chat's slim frame above the thread, so the message box stays on screen.
    <ThreadPrimitive.Root className="flex h-[calc(100vh-120px)] min-h-[480px] flex-col bg-base-max">
      <ChatEvidenceProvider>
        <ThreadPrimitive.Viewport
          turnAnchor="top"
          scrollToBottomOnInitialize={false}
          className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden pt-8"
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
      </ChatEvidenceProvider>
    </ThreadPrimitive.Root>
  );
};

export default ChatThread;
