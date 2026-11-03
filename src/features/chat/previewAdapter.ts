import type { ChatModelAdapter, ThreadMessage } from '@assistant-ui/react';
import { toMessageContent } from './agentResponse';
import { findRecordedResponse } from './recordedResponses';

export const PREVIEW_REPLY =
  "Chat isn't connected to the research agent yet, so this question wasn't run.";

// Any other status can make assistant-ui call this adapter again, replaying forever.
const COMPLETE = { type: 'complete', reason: 'stop' } as const;

const lastMessageText = (messages: readonly ThreadMessage[]) =>
  (messages.at(-1)?.content ?? [])
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n');

// Stands in for the agent: a runtime that calls it replaces this file once it is connected.
export const previewAdapter = {
  run: async ({ messages }: { messages: readonly ThreadMessage[] }) => {
    const recorded = await findRecordedResponse(lastMessageText(messages));
    return {
      content: recorded
        ? toMessageContent(recorded, { recorded: true })
        : [{ type: 'text' as const, text: PREVIEW_REPLY }],
      status: COMPLETE,
    };
  },
} satisfies ChatModelAdapter;
