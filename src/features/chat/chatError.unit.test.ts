import { chatErrorMessage } from './chatError';

describe('chatErrorMessage', () => {
  it.each(['The agent could not finish this run.', 'The agent stream was interrupted.'])(
    'keeps the agent message: %s',
    (message) => {
      expect(chatErrorMessage(message)).toBe(message);
      expect(chatErrorMessage(new Error(message))).toBe(message);
    },
  );

  it.each([
    'HTTP 502: {"error":"The agent is unavailable"}',
    'Failed to fetch',
    'arn:aws:bedrock-agentcore:us-west-2:1:runtime/x is not authorized',
    undefined,
    {},
  ])('replaces anything else: %s', (error) => {
    expect(chatErrorMessage(error)).toBe('The research agent is unavailable. Please try again.');
  });
});
