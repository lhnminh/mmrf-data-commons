const UNAVAILABLE = 'The research agent is unavailable. Please try again.';

// Written by the agent and the dev route for people to read. Anything else, such as a
// status line or an AWS error, is replaced, so it never reaches the conversation.
const AGENT_MESSAGES: ReadonlySet<string> = new Set([
  'The agent could not finish this run.',
  'The agent stream was interrupted.',
]);

export const chatErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : error;
  return typeof message === 'string' && AGENT_MESSAGES.has(message) ? message : UNAVAILABLE;
};
