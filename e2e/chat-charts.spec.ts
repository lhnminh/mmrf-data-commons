import { expect, test, type Page, type Request } from '@playwright/test';
import { loadStream, mockAgent, streamGate, type AgentEvent } from './support/agentStream';
import { addFilter } from './support/cohortStore';
import { signIn } from './support/session';

const RACE = 'demographic.race';
const RACE_VALUE = 'black or african american';
const GENDER = 'demographic.gender';
const COHORT_LABEL = `Cohort: Race: ${RACE_VALUE}, 334 cases`;
const LOLLIPOP_PROMPT = 'Show the Lollipop plot for KRAS.';

test.describe.configure({ timeout: 90_000 });

const composer = (page: Page) => page.getByRole('textbox', { name: 'Ask about the Virtual Lab' });
const frame = (page: Page) => page.getByTestId('chart-frame');
const chartText = (page: Page, text: string) =>
  frame(page).locator('svg text').filter({ hasText: new RegExp(`^${text}\\b`) }).first();

interface ChartRequest {
  readonly url: string;
  readonly text: string;
}

/** Every request a chart makes through the data route. */
const captureCharts = (page: Page) => {
  const seen: ChartRequest[] = [];
  page.on('request', (request: Request) => {
    const url = request.url();
    if (!url.includes('/protein-paint/')) return;
    seen.push({ url, text: decodeURIComponent(`${url} ${request.postData() ?? ''}`) });
  });
  return seen;
};

const withFilter = (seen: ReadonlyArray<ChartRequest>, value: string) =>
  seen.filter(({ text }) => text.includes('filter0') && text.includes(value));

/** Waits until a chart has stopped asking for data. */
const settled = async (seen: ReadonlyArray<ChartRequest>) => {
  let last = -1;
  await expect
    .poll(
      () => {
        const same = seen.length === last;
        last = seen.length;
        return same && seen.length > 0;
      },
      { intervals: [2_000], timeout: 45_000 },
    )
    .toBe(true);
};

const QUIET_MS = 2_000;

const open = async (page: Page, streams: Parameters<typeof mockAgent>[1], options?: Parameters<typeof mockAgent>[2]) => {
  await signIn(page);
  const seen = captureCharts(page);
  const posted = await mockAgent(page, streams, options);
  await page.goto('/?app=Chat');
  await expect(composer(page)).toBeVisible();
  return { seen, posted };
};

const ask = async (page: Page, text = 'Go') => {
  await composer(page).fill(text);
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  await composer(page).press('Enter');
};

/** A run that returns one tool result, with the cohort the agent recorded for it. */
const chartRun = (
  tool: 'show_oncomatrix' | 'show_lollipop',
  args: object,
  result: object,
  snapshot?: object,
): AgentEvent[] => [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  ...(snapshot ? [{ type: 'STATE_SNAPSHOT', snapshot: { cohort: snapshot } }] : []),
  { type: 'TOOL_CALL_START', toolCallId: 'c', toolCallName: `virtual-lab___${tool}` },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'c', delta: JSON.stringify(args) },
  { type: 'TOOL_CALL_END', toolCallId: 'c' },
  { type: 'TOOL_CALL_RESULT', messageId: 'm-tool', toolCallId: 'c', content: JSON.stringify(result) },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' },
];

const GENES = [
  { gene: 'KRAS', count: 148 },
  { gene: 'NRAS', count: 113 },
  { gene: 'DIS3', count: 98 },
  { gene: 'BRAF', count: 76 },
];

const matrixResult = (revision: number, label: string, caseCount: number, plot: object = {}) => ({
  status: 'ok',
  summary: 'Matrix summary.',
  genes: GENES,
  caseCount,
  sampleCount: 287,
  cohort: { label, caseCount, revision },
  plot: { type: 'oncomatrix', ...plot },
});

const noFilterCohort = {
  filter: null,
  label: 'All cases',
  caseCount: 1000,
  revision: 1,
  changedOutsideChat: false,
};
const raceCohort = {
  filter: { and: [{ in: { [RACE]: [RACE_VALUE] } }] },
  label: `Race: ${RACE_VALUE}`,
  caseCount: 334,
  revision: 2,
  changedOutsideChat: false,
};

const emptyRun: AgentEvent[] = [
  { type: 'RUN_STARTED', threadId: 't', runId: 'next' },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'next' },
];

const journey = () => loadStream('journey-oncomatrix');
const lollipop = () => loadStream('journey-lollipop');

test('oncomatrix renders in chat', async ({ page }) => {
  const { seen } = await open(page, journey());
  await ask(page);
  await expect(page.getByText('OncoMatrix · 6 genes')).toBeVisible();
  await expect(frame(page).getByText(COHORT_LABEL)).toBeVisible();
  await expect(chartText(page, 'KRAS')).toBeVisible({ timeout: 45_000 });
  expect(seen.length).toBeGreaterThan(0);
});

test('lollipop renders for the gene', async ({ page }) => {
  const { seen } = await open(page, lollipop());
  await ask(page);
  await expect(page.getByText('ProteinPaint · Lollipop plot · KRAS')).toBeVisible();
  await expect(frame(page).getByText(COHORT_LABEL)).toBeVisible();
  await expect(frame(page).locator('.sja_Block_div svg').first()).toBeVisible({ timeout: 45_000 });
  // The same protein view the search box opens, with the track fetched for this gene.
  await expect(chartText(page, 'KRAS')).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => withFilter(seen, 'mds3').length, { timeout: 45_000 }).toBeGreaterThan(0);
});

for (const [name, stream] of [
  ['oncomatrix', journey],
  ['lollipop', lollipop],
] as const) {
  test(`chart requests carry the revision's filter: ${name}`, async ({ page }) => {
    const { seen } = await open(page, stream());
    await ask(page);
    await expect.poll(() => withFilter(seen, RACE_VALUE).length, { timeout: 45_000 }).toBeGreaterThan(0);
    expect(withFilter(seen, RACE_VALUE)[0].text).toContain(RACE);
  });
}

test('a maxGenes setting limits the matrix', async ({ page }) => {
  const { seen } = await open(
    page,
    chartRun('show_oncomatrix', { maxGenes: 3 }, matrixResult(2, raceCohort.label, 334, { maxGenes: 3 }), raceCohort),
  );
  await ask(page);
  await expect.poll(() => seen.some(({ text }) => /maxGenes"?[:=]3\b/.test(text)), { timeout: 45_000 }).toBe(true);
  expect(seen.some(({ text }) => /maxGenes"?[:=]50\b/.test(text))).toBe(false);
  await expect(chartText(page, 'KRAS')).toBeVisible({ timeout: 45_000 });
  await expect(frame(page).getByText('3 Genes', { exact: true })).toBeVisible();
});

test('a cohort with no filters draws all cases', async ({ page }) => {
  const { seen } = await open(
    page,
    chartRun('show_oncomatrix', {}, matrixResult(1, 'All cases', 1000), noFilterCohort),
  );
  await ask(page);
  await expect(frame(page).getByText('Cohort: All cases, 1,000 cases')).toBeVisible();
  await expect(chartText(page, 'KRAS')).toBeVisible({ timeout: 45_000 });
  expect(withFilter(seen, RACE_VALUE)).toEqual([]);
});

for (const [name, stream] of [
  ['oncomatrix', journey],
  ['lollipop', lollipop],
] as const) {
  test(`an old chart keeps its cohort: ${name}`, async ({ page }) => {
    const { seen } = await open(page, stream());
    await ask(page);
    await expect(chartText(page, 'KRAS')).toBeVisible({ timeout: 45_000 });
    await settled(seen);
    const before = seen.length;

    await addFilter(page, GENDER, ['female']);
    await expect(page.getByText('Sex', { exact: true })).toBeVisible();
    await page.waitForTimeout(QUIET_MS);

    expect(seen.length).toBe(before);
    await expect(frame(page).getByText(COHORT_LABEL)).toBeVisible();
    await expect(chartText(page, 'KRAS')).toBeVisible();
  });
}

test('the journey keeps the matrix when the lollipop plot opens', async ({ page }) => {
  const { seen } = await open(page, [journey(), lollipop()]);
  await ask(page);
  await expect(chartText(page, 'KRAS')).toBeVisible({ timeout: 45_000 });
  await settled(seen);
  const matrixCalls = () => seen.filter(({ url }) => url.includes('topMutatedGenes')).length;
  const before = matrixCalls();

  await page.getByRole('button', { name: 'Lollipop for KRAS' }).click();
  await expect(frame(page)).toHaveCount(2);
  await expect(frame(page).nth(1).locator('.sja_Block_div svg').first()).toBeVisible({ timeout: 45_000 });
  await settled(seen);
  expect(matrixCalls()).toBe(before);
  await expect(frame(page).nth(0).locator('svg text').filter({ hasText: /^KRAS\b/ }).first()).toBeAttached();
});

test('unknown revision is not drawn on the current cohort', async ({ page }) => {
  const { seen } = await open(
    page,
    chartRun('show_oncomatrix', {}, matrixResult(99, raceCohort.label, 334)),
  );
  await ask(page);
  await expect(page.getByText("This chart's cohort is no longer available")).toBeVisible();
  await page.waitForTimeout(QUIET_MS);
  expect(seen).toEqual([]);
});

test('a chart waits for its cohort while the run is going', async ({ page }) => {
  const gate = streamGate((event: AgentEvent) => event.type === 'RUN_FINISHED');
  const { seen } = await open(
    page,
    chartRun('show_oncomatrix', {}, matrixResult(99, raceCohort.label, 334)),
    { gate },
  );
  await ask(page);
  await gate.reached;
  await expect(page.getByText("Waiting for this chart's cohort")).toBeVisible();
  expect(seen).toEqual([]);
  gate.release();
  await expect(page.getByText("This chart's cohort is no longer available")).toBeVisible();
});

test.describe('standard pages are unchanged', () => {
  test('?app=OncoMatrix follows the dropdown', async ({ page }) => {
    await signIn(page);
    const seen = captureCharts(page);
    await page.goto('/?app=OncoMatrix');
    await expect(page.locator('.sjpp-wrapper-root-div svg').first()).toBeVisible({ timeout: 45_000 });
    expect(withFilter(seen, RACE_VALUE)).toEqual([]);

    await addFilter(page, RACE, [RACE_VALUE]);
    await expect.poll(() => withFilter(seen, RACE_VALUE).length, { timeout: 45_000 }).toBeGreaterThan(0);
  });

  test('?app=ProteinPaint follows the dropdown', async ({ page }) => {
    await signIn(page);
    const seen = captureCharts(page);
    await page.goto('/?app=ProteinPaint');
    const search = page.locator('.sjpp-wrapper-root-div input[type="search"], .sjpp-wrapper-root-div input').first();
    await expect(search).toBeVisible({ timeout: 45_000 });
    await addFilter(page, RACE, [RACE_VALUE]);
    await search.fill('KRAS');
    await search.press('Enter');
    await expect.poll(() => withFilter(seen, RACE_VALUE).length, { timeout: 45_000 }).toBeGreaterThan(0);

    await addFilter(page, GENDER, ['female']);
    await expect.poll(() => withFilter(seen, 'female').length, { timeout: 45_000 }).toBeGreaterThan(0);
  });
});

test('lollipop buttons send a visible message', async ({ page }) => {
  const gate = streamGate((event: AgentEvent) => event.type === 'RUN_FINISHED');
  const { posted } = await open(page, [journey(), emptyRun], { gate });
  await ask(page);
  const button = page.getByRole('button', { name: 'Lollipop for KRAS' });
  await expect(button).toBeDisabled();
  gate.release();
  await expect(button).toBeEnabled();
  await expect(page.getByRole('button', { name: /^Lollipop for / })).toHaveCount(3);

  await button.click();
  await expect.poll(() => posted.length).toBe(2);
  expect(posted[1].messages.at(-1)).toMatchObject({ role: 'user' });
  expect(JSON.stringify(posted[1].messages.at(-1))).toContain(LOLLIPOP_PROMPT);
  await expect(page.getByRole('heading', { name: LOLLIPOP_PROMPT })).toBeVisible();
});

test('no_data shows no chart', async ({ page }) => {
  const { seen } = await open(page, loadStream('no-data-for-gene'));
  await ask(page);
  await expect(page.locator('p.break-words', { hasText: "EGFR isn't in this dataset." })).toBeVisible();
  await page.waitForTimeout(QUIET_MS);
  await expect(frame(page)).toHaveCount(0);
  expect(seen).toEqual([]);
});

test('none_in_cohort shows no chart', async ({ page }) => {
  const { seen } = await open(page, loadStream('none-in-cohort'));
  await ask(page);
  await expect(page.locator('p.break-words', { hasText: '0 of 6 cases' })).toBeVisible();
  await page.waitForTimeout(QUIET_MS);
  await expect(frame(page)).toHaveCount(0);
  expect(seen).toEqual([]);
});

test('re-render makes no extra requests', async ({ page }) => {
  const { seen } = await open(page, lollipop());
  await ask(page);
  await expect(chartText(page, 'KRAS')).toBeVisible({ timeout: 45_000 });
  await settled(seen);
  const before = seen.length;

  await composer(page).pressSequentially('Typing a question');
  await page.waitForTimeout(QUIET_MS);
  expect(seen.length).toBe(before);
});

test('a tool step expands to show its settings', async ({ page }) => {
  await open(page, lollipop());
  await ask(page);
  const row = page.locator('details', { hasText: 'gene' });
  await expect(row).toHaveCount(1);
  await expect(row.getByText('KRAS')).toBeHidden();
  await row.locator('summary').click();
  await expect(row.getByText('KRAS')).toBeVisible();
  await expect(row).not.toContainText('demographic');
});

test('the empty state describes what chat can do', async ({ page }) => {
  await open(page, emptyRun);
  await expect(
    page.getByText("Ask what's mutated in a group of patients, or where a gene's mutations fall on the protein."),
  ).toBeVisible();
  await expect(page.getByText("can't run analyses yet")).toHaveCount(0);
  for (const prompt of ["What's mutated in Black patients?", 'Show a Lollipop plot for KRAS', 'Is the Virtual Lab healthy?']) {
    await expect(page.getByRole('button', { name: prompt })).toBeVisible();
  }
});

for (const [name, stream] of [
  ['oncomatrix', journey],
  ['lollipop', lollipop],
] as const) {
  test(`charts fit: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { seen } = await open(page, stream());
    await ask(page);
    await expect(chartText(page, 'KRAS')).toBeVisible({ timeout: 45_000 });
    await settled(seen);
    const fit = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(fit.scroll).toBeLessThanOrEqual(fit.client);
    const box = await frame(page).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(660);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1280);
  });
}
