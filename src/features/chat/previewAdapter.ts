import type { ChatModelAdapter } from '@assistant-ui/react';

export const PREVIEW_REPLY =
  "Chat isn't connected to the research agent yet, so this question wasn't run.";

// Stands in for the agent: the AG-UI runtime replaces this file once it is connected.
export const previewAdapter = {
  run: async () => ({
    content: [{ type: 'text' as const, text: PREVIEW_REPLY }],
  }),
} satisfies ChatModelAdapter;
