import type { ChatModelAdapter } from '@assistant-ui/react';

type TextTurn = { role: 'user' | 'assistant'; content: string };

function textFromMessage(message: { content: readonly { type: string; text?: string }[] }) {
  return message.content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

export const agentAdapter = {
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
        body: JSON.stringify({ prompt: latest.content, history: turns.slice(0, -1).slice(-10) }),
        signal: abortSignal,
      });
      if (!response.ok) throw new Error(`Agent returned HTTP ${response.status}`);
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' ||
          !('message' in result) || typeof result.message !== 'string' || !result.message.trim()) {
        throw new Error('Agent returned an empty response');
      }
      return { content: [{ type: 'text' as const, text: result.message }] };
    } catch (error) {
      if (abortSignal.aborted) throw error;
      return { content: [{ type: 'text' as const, text: 'The research agent is unavailable. Please try again.' }] };
    }
  },
} satisfies ChatModelAdapter;
