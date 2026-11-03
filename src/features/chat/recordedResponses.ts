import type { AgentResponse } from './agentResponse';
import { SURVIVAL_PROMPT } from './suggestedPrompts';

/**
 * Finds a saved agent response for an exact question.
 *
 * The fixture's plot and summary are real output of anderMatt's
 * createRoutingExecutor (feat/correlation-plot-tool at f7f5a0b), run against the
 * local stack with no model. Its message is the tool summary standing in for a
 * model reply, because no model ran.
 */
export const findRecordedResponse = async (
  question: string,
): Promise<AgentResponse | null> => {
  if (question.trim() !== SURVIVAL_PROMPT) return null;
  const fixture = await import('./fixtures/survival-cgs.response.json');
  return fixture.default as unknown as AgentResponse;
};
