import type { ChatModelAdapter, ToolCallMessagePartProps } from '@assistant-ui/react';

type TextTurn = { role: 'user' | 'assistant'; content: string };

function textFromMessage(message: { content: readonly { type: string; text?: string }[] }) {
  return message.content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

type ToolCall = { name: string; input: Record<string, unknown>; status: string; result?: { summary: string; plot?: unknown }; error?: string };

export function createAgentAdapter(getCohortFilter: () => unknown = () => null) {
return {
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
      return { content: [{ type: 'text' as const, text: 'Please enter a question.' }] };
    }

    try {
      const response = await fetch('/agent/v1/prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: latest.content, history: turns.slice(0, -1).slice(-10),
          context: { cohortFilter: getCohortFilter() } }),
        signal: abortSignal,
      });
      if (!response.ok) throw new Error(`Agent returned HTTP ${response.status}`);
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' ||
          !('message' in result) || typeof result.message !== 'string' || !result.message.trim()) {
        throw new Error('Agent returned an empty response');
      }
      const calls = 'toolCalls' in result && Array.isArray(result.toolCalls)
        ? result.toolCalls as ToolCall[] : [];
      return { content: [
        { type: 'text' as const, text: result.message },
        ...calls.map((call, index) => ({
          type: 'tool-call' as const,
          toolCallId: `${index}-${call.name}`,
          toolName: call.name,
          args: call.input as ToolCallMessagePartProps['args'],
          argsText: JSON.stringify(call.input),
          result: call.result,
          isError: call.status === 'error',
        })),
      ] };
    } catch (error) {
      if (abortSignal.aborted) throw error;
      return { content: [{ type: 'text' as const, text: 'The research agent is unavailable. Please try again.' }] };
    }
  },
} satisfies ChatModelAdapter;
}

export const agentAdapter = createAgentAdapter();
