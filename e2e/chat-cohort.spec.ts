import { expect, test, type Page } from '@playwright/test';
import { loadStream, mockAgent, streamGate, type AgentEvent, type PostedRun } from './support/agentStream';
import { addFilter, filterFields } from './support/cohortStore';
import { signIn } from './support/session';

const RACE = 'demographic.race';
const GENDER = 'demographic.gender';
const PROMPT = "What's mutated in Black patients?";

const journey = () => loadStream('journey-oncomatrix');
const noChange = () => loadStream('unknown-field');

const composer = (page: Page) => page.getByRole('textbox', { name: 'Ask about the Virtual Lab' });

/** With text in the box, Send is enabled only once the run before it has ended. */
const typeWhenIdle = async (page: Page, text: string) => {
  await composer(page).fill(text);
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
};

const finished = async (page: Page) => {
  await typeWhenIdle(page, 'x');
  await composer(page).fill('');
};

const ask = async (page: Page, text = PROMPT) => {
  await typeWhenIdle(page, text);
  await composer(page).press('Enter');
};

const open = async (page: Page, streams: Parameters<typeof mockAgent>[1], options?: Parameters<typeof mockAgent>[2]) => {
  await signIn(page);
  const posted = await mockAgent(page, streams, options);
  await page.goto('/?app=Chat');
  await expect(composer(page)).toBeVisible();
  return posted;
};

const updated = (page: Page) => page.getByText('Cohort Builder · Updated cohort');
const step = (page: Page, text: string) => page.locator('p.break-words', { hasText: text });
const panel = (page: Page, name: string) => page.getByText(name, { exact: true });
const cohort = (run: PostedRun) => (run.state as { cohort: Record<string, unknown> }).cohort;

/** Waits for a run's snapshot to have been applied, then for the run to end. */
const applied = async (page: Page, posted: PostedRun[]) => {
  await expect.poll(() => posted.length).toBe(1);
  await expect(updated(page)).toBeVisible();
  await expect.poll(() => filterFields(page)).toContain(RACE);
  await finished(page);
};

test('chat changes the dropdown', async ({ page }) => {
  await open(page, journey());
  await ask(page);
  await expect(panel(page, 'Race')).toBeVisible();
  // The chat step, and the cohort bar's own count for the filter it just applied.
  await expect(page.getByText('334 cases', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('334 Cases', { exact: true })).toBeVisible();
  await expect(page.getByText(/Race: black or african american/).first()).toBeVisible();
  expect(await filterFields(page)).toEqual([RACE]);
});

test('state goes out on the next run', async ({ page }) => {
  const posted = await open(page, [journey(), noChange()]);
  await ask(page);
  await applied(page, posted);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

  await ask(page, 'And again?');
  await expect.poll(() => posted.length).toBe(2);

  expect(cohort(posted[0])).toMatchObject({ revision: 1, filter: null, label: 'All cases', changedOutsideChat: false });
  expect(cohort(posted[1])).toMatchObject({
    revision: 2,
    filter: { and: [{ in: { [RACE]: ['black or african american'] } }] },
    label: 'Race: black or african american',
    changedOutsideChat: false,
  });
  expect(posted[1].context).toEqual([]);
});

test("a replayed snapshot doesn't reapply", async ({ page }) => {
  const posted = await open(page, journey());
  await ask(page);
  await applied(page, posted);

  // The value's own remove button in the filter panel, as a researcher would.
  await page.getByTestId(/^query-rep-demographic\.race-/).click();
  await expect(panel(page, 'Race')).toHaveCount(0);

  await ask(page, 'And again?');
  await expect.poll(() => posted.length).toBe(2);
  await finished(page);

  expect(cohort(posted[1])).toMatchObject({ revision: 3, filter: null, changedOutsideChat: true });
  expect(await filterFields(page)).toEqual([]);
  await expect(panel(page, 'Race')).toHaveCount(0);
});

test('a manual change during a run survives', async ({ page }) => {
  const gate = streamGate((event: AgentEvent) => event.type === 'TOOL_CALL_START');
  const posted = await open(page, [journey(), noChange()], { gate });
  await ask(page);
  await gate.reached;

  await addFilter(page, GENDER, ['female']);
  await expect(panel(page, 'Sex')).toBeVisible();
  gate.release();

  await applied(page, posted);
  await expect.poll(() => filterFields(page)).toEqual([GENDER, RACE]);
  await expect(panel(page, 'Race')).toBeVisible();
  await expect(panel(page, 'Sex')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);

  await ask(page, 'And again?');
  await expect.poll(() => posted.length).toBe(2);
  expect(cohort(posted[1])).toMatchObject({ revision: 3, changedOutsideChat: true });
  expect(JSON.stringify(cohort(posted[1]).filter)).toContain(RACE);
  expect(JSON.stringify(cohort(posted[1]).filter)).toContain(GENDER);
});

test('manual change is flagged', async ({ page }) => {
  const posted = await open(page, noChange());
  await addFilter(page, GENDER, ['female']);
  await expect(panel(page, 'Sex')).toBeVisible();

  await ask(page, 'First');
  await expect.poll(() => posted.length).toBe(1);
  expect(cohort(posted[0])).toMatchObject({ revision: 2, changedOutsideChat: true, label: 'Sex: female' });
  await expect(step(page, 'no cohort field called')).toBeVisible();
  await finished(page);

  await ask(page, 'Second');
  await expect.poll(() => posted.length).toBe(2);
  expect(cohort(posted[1])).toMatchObject({ revision: 2, changedOutsideChat: false });
});

test('the cohort bar count goes out', async ({ page }) => {
  const posted = await open(page, noChange());
  // Read from the page's own cohort bar, because the count differs between deployments.
  const bar = page.getByText(/^[\d,]+\s+Cases$/).first();
  await expect(bar).toBeVisible();
  const shown = Number(((await bar.textContent()) ?? '').replace(/\D/g, ''));
  await ask(page, 'First');
  await expect.poll(() => posted.length).toBe(1);
  expect(cohort(posted[0]).caseCount).toBe(shown);
});

test('undo restores and records', async ({ page }) => {
  const posted = await open(page, [journey(), noChange()]);
  await ask(page);
  await applied(page, posted);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(panel(page, 'Race')).toHaveCount(0);
  expect(await filterFields(page)).toEqual([]);
  await expect(page.getByText('Undone', { exact: true })).toBeVisible();
  await expect(page.getByText('Cohort restored: 1,000 cases.')).toBeVisible();
  // The button is gone, so a second click has nothing to land on.
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);

  await ask(page, 'And again?');
  await expect.poll(() => posted.length).toBe(2);
  expect(cohort(posted[1])).toMatchObject({ revision: 3, filter: null, changedOutsideChat: false });
});

test('no undo after a manual edit', async ({ page }) => {
  const posted = await open(page, journey());
  await ask(page);
  await applied(page, posted);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

  await addFilter(page, GENDER, ['female']);
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await expect(page.getByText('Undone', { exact: true })).toHaveCount(0);
});

test('ambiguous asks with buttons', async ({ page }) => {
  // Hand-written: a recorded stream's message snapshot would replace the message on screen with its own.
  const answer: AgentEvent[] = [
    { type: 'RUN_STARTED', threadId: 't', runId: 'next' },
    { type: 'RUN_FINISHED', threadId: 't', runId: 'next' },
  ];
  const posted = await open(page, [loadStream('ambiguous'), answer]);
  await ask(page, 'Hispanic patients');
  const option = page.getByRole('button', { name: 'hispanic or latino', exact: true });
  await expect(option).toBeVisible();
  await expect(page.getByRole('button', { name: 'not hispanic or latino' })).toBeVisible();
  await finished(page);
  expect(await filterFields(page)).toEqual([]);

  await option.click();
  await expect.poll(() => posted.length).toBe(2);
  const sent = 'Use hispanic or latino for Ethnicity.';
  expect(posted[1].messages.at(-1)).toMatchObject({ role: 'user' });
  expect(JSON.stringify(posted[1].messages.at(-1))).toContain(sent);
  await expect(page.getByRole('heading', { name: sent })).toBeVisible();
  expect(await filterFields(page)).toEqual([]);
});

test('a failed run reports it', async ({ page }) => {
  await open(page, loadStream('tool-failure'));
  await ask(page, 'Run it');
  await expect(page.getByText('Failed', { exact: true })).toBeVisible();
  await expect(step(page, 'The Virtual Lab data query failed.')).toBeVisible();
  await finished(page);
  expect(await filterFields(page)).toEqual([]);
});

test('no cohort data in the prompt path', async ({ page }) => {
  const posted = await open(page, [journey(), noChange()]);
  await ask(page);
  await applied(page, posted);
  await addFilter(page, GENDER, ['female']);
  await ask(page, 'And again?');
  await expect.poll(() => posted.length).toBe(2);

  for (const run of posted) {
    expect(run.context).toEqual([]);
    expect(run.tools).toEqual([]);
    expect(JSON.stringify(run.context)).not.toContain(RACE);
    expect(JSON.stringify(run.context)).not.toContain(GENDER);
    expect(JSON.stringify(run.forwardedProps ?? {})).not.toContain('demographic');
    expect(JSON.stringify(run.messages)).not.toContain(GENDER);
  }
  expect(JSON.stringify(cohort(posted[1]).filter)).toContain(GENDER);
});
