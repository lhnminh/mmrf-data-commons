import { expect, test } from '@playwright/test';
import { mockAgent, type AgentEvent } from './support/agentStream';
import { signIn } from './support/session';

const TOOL = 'virtual-lab___check_virtual_lab_health';
const PROMPT = 'Is the Virtual Lab healthy?';

const run = (result: string, text: string): AgentEvent[] => [
  { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
  { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: TOOL },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta: '{}' },
  { type: 'TOOL_CALL_END', toolCallId: 'c1' },
  { type: 'TOOL_CALL_RESULT', messageId: 'm-tool', toolCallId: 'c1', content: result },
  { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: text.slice(0, 20) },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: text.slice(20) },
  { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
  { type: 'RUN_FINISHED', threadId: 't1', runId: 'r1' },
];

const healthyRun = run(
  JSON.stringify({ status: 'ok', summary: 'Healthy' }),
  'Yes, the Virtual Lab is healthy, with 1,000 synthetic cases available.',
);

test('shows a tool row, then streamed text, from a recorded run', async ({ page }) => {
  await signIn(page);
  const posted = await mockAgent(page, healthyRun, { delayMs: 50 });
  await page.goto('/?app=Chat');
  await page.getByRole('button', { name: PROMPT }).click();
  await expect(page.getByText('check_virtual_lab_health')).toBeVisible();
  await expect(page.getByText(/1,000 synthetic cases/)).toBeVisible();
  expect(posted[0].messages.at(-1)?.role).toBe('user');
});

test('shows a plain message when the agent is unreachable', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/agent/agui', (r) => r.fulfill({ status: 502, json: { error: 'x' } }));
  await page.goto('/?app=Chat');
  await page.getByRole('button', { name: PROMPT }).click();
  await expect(page.getByText('The research agent is unavailable. Please try again.')).toBeVisible();
  // Scoped to the page: in dev, Next's own error overlay (outside <main>) shows the raw error.
  await expect(page.locator('main').getByText(/HTTP 502/)).toHaveCount(0);
});

test('marks a tool that reports a failure as Failed, with its reason', async ({ page }) => {
  await signIn(page);
  const failing = run(
    JSON.stringify({ status: 'error', summary: 'The Virtual Lab refused the login.' }),
    'I could not check the Virtual Lab.',
  );
  await mockAgent(page, failing);
  await page.goto('/?app=Chat');
  await page.getByRole('button', { name: PROMPT }).click();
  await expect(page.getByText('check_virtual_lab_health')).toBeVisible();
  await expect(page.getByText('Failed', { exact: true })).toBeVisible();
  await expect(page.getByText('The Virtual Lab refused the login.')).toBeVisible();
});
