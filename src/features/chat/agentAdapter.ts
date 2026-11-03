import type { ChatModelAdapter } from '@assistant-ui/react';
import { type AgentResponse, toMessageContent } from './agentResponse';

// Any other status can make assistant-ui call this adapter again once every tool has a result.
const COMPLETE = { type: 'complete', reason: 'stop' } as const;

const hasAnswer = (result: unknown): result is AgentResponse => {
  const { message, toolCalls } = (result ?? {}) as Partial<AgentResponse>;
  if (typeof message !== 'string') return false;
  return message.trim().length > 0 || (Array.isArray(toolCalls) && toolCalls.length > 0);
};

type TextTurn = { role: 'user' | 'assistant'; content: string };

function textFromMessage(message: { content: readonly { type: string; text?: string }[] }) {
  return message.content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

/** getCohortFilter is read per question, so it always reflects the cohort selected at that moment. */
export const createAgentAdapter = (getCohortFilter: () => object | undefined) => ({
  async run({ messages, abortSignal }) {
    const turns: TextTurn[] = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role as TextTurn['role'],
        content: textFromMessage(message).slice(0, 2000),
      }))
      .filter((turn) => turn.content.length > 0);
    const latest = turns.at(-1);
    if (!latest || latest.role !== 'user') {
      return { content: [{ type: 'text' as const, text: 'Please enter a question.' }], status: COMPLETE };
    }

    const cohortFilter = getCohortFilter();
    try {
      const response = await fetch('/agent/v1/prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: latest.content,
          history: turns.slice(0, -1).slice(-10),
          ...(cohortFilter ? { context: { cohortFilter } } : {}),
        }),
        signal: abortSignal,
      });
      if (!response.ok) throw new Error(`Agent returned HTTP ${response.status}`);
      const result: unknown = await response.json();
      if (!hasAnswer(result)) throw new Error('Agent returned an empty response');
      return {
        content: toMessageContent({ message: result.message, toolCalls: result.toolCalls ?? [] }),
        status: COMPLETE,
      };
    } catch (error) {
      if (abortSignal.aborted) throw error;
      return { content: [{ type: 'text' as const, text: 'The research agent is unavailable. Please try again.' }], status: COMPLETE };
    }
  },
}) satisfies ChatModelAdapter;
