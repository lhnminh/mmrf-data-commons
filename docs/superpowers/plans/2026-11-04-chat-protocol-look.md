# Chat Protocol Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Virtual Lab Chat a slim page frame, a rail of tool steps, labelled answers and numbers that link to their source steps.

**Architecture:** A Chat-only check in `_app.tsx`, `pages/index.tsx` and `ApplicationWorkspace.tsx` swaps the platform chrome for a slim header and cohort strip. The assistant-ui primitives and part order stay, and the components are restyled. Answer sections and number links are pure functions that `MarkdownText` uses, and each falls back to ordinary Markdown.

**Tech Stack:** Next.js pages router, React, Tailwind 3, `@assistant-ui/react` 0.15, `react-markdown` 10, `@gen3/core`, Jest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-04-chat-protocol-look-design.md`

## Global Constraints

- Run all commands from `my-forks/mmrf-data-commons`. Next.js differs from training data, so read `node_modules/next/dist/docs/` before using a Next.js API not already used in this code.
- Run Chat tests with `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat`. The baseline is 8 suites and 88 tests passing.
- Everything outside Chat keeps today's behaviour. Gate page changes on `router.pathname === '/'` and `query.app === 'Chat'`.
- Banner text stays exactly `Synthetic sandbox — all data is fabricated and has no clinical meaning.` The sandbox's UI tests match it.
- Existing tests pin these and they must keep passing: titles such as `Cohort Builder · Updated cohort`, `Undone`, `Cohort restored: 1,000 cases.`, `Done`, `Failed`, `334 cases`, button names equal to the prompt text, and a textbox named `Ask about the Virtual Lab`.
- Colours come from theme classes: `primary` (plum), `secondary` (purple), `base-lighter`, `base-lightest`, `gunmetal`, `seashell`, `rust`. Fonts come from `font-heading` and `font-content`.
- Animations use `motion-safe:`. Every control keeps a visible focus ring (`FOCUS_RING` in `ChatThread.tsx`).
- Case IDs never appear in the UI.
- Don't add `AGENTS.md` or `CLAUDE.md` (untracked, written by `next dev`). Use explicit paths with `git add`.
- Commit messages follow `feat(chat): ...` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push nothing unless asked.

## Review Focus

1. A filter built from a saved case-ID list: the strip shows `Selected cases` and never the IDs. Pinned in Task 1.
2. A total count of 0, a failed count or cases above the total: no `NaN` width and no broken line. Pinned in Task 1.
3. Ordinary prose that starts with a label word, such as `Limits of this cohort are...`: it stays prose rather than becoming a section. Pinned in Task 4.
4. Numbers inside identifiers (`p.G12V`, `c.238+2T>C`, `SYNTH-CASE-0001`) or a partly matched `1,000a`: never linked. Pinned in Task 5.
5. A message still streaming, or a tool result that isn't valid JSON: no links and no crash. Pinned in Task 5.

---

### Task 1: Branch, spec commit and cohort strip

**Files:**
- Modify: `src/features/chat/cohortSync.ts:78-95`
- Create: `src/features/chat/ChatCohortStrip.tsx`
- Test: `src/features/chat/cohortSync.unit.test.ts`, `src/features/chat/ChatCohortStrip.unit.test.tsx`

**Interfaces:**
- Produces: `cohortFilterLabels(filterSet: FilterSet): ReadonlyArray<string>`, `cohortShare(cases?: number, total?: number): number | undefined` (0-100, clamped), and default export `ChatCohortStrip: React.FC`.

- [ ] **Step 1: Create the branch and commit the spec and plan**

```bash
git fetch origin
git switch -c feature/chat-protocol-look origin/main
git add docs/superpowers/specs/2026-11-04-chat-protocol-look-design.md docs/superpowers/plans/2026-11-04-chat-protocol-look.md
git commit -m "docs(chat): add the Protocol look spec and plan"
```

- [ ] **Step 2: Write the failing tests**

In `cohortSync.unit.test.ts`:

```ts
describe('cohortFilterLabels', () => {
  const set = (root: object) => ({ mode: 'and', root }) as FilterSet;

  it('labels each filter', () => {
    expect(cohortFilterLabels(set({
      'demographic.race': { operator: 'in', field: 'demographic.race', operands: ['black or african american'] },
      'demographic.gender': { operator: 'in', field: 'demographic.gender', operands: ['female'] },
    }))).toEqual(['Race: black or african american', 'Gender: female']);
  });

  it('is empty with no filters', () => expect(cohortFilterLabels(set({}))).toEqual([]));

  it('names case IDs without listing them', () => {
    const labels = cohortFilterLabels(set({
      [CASE_ID_FIELD]: { operator: 'in', field: CASE_ID_FIELD, operands: ['SYNTH-CASE-0001'] },
    }));
    expect(labels).toEqual(['Selected cases']);
  });
});
```

Keep the existing `cohortLabel` tests unchanged. In `ChatCohortStrip.unit.test.tsx`, follow `useCohortSync.unit.test.tsx`: real `coreStore` and `CoreProvider`, with `useGetCountsQuery` mocked per test.

```tsx
it('shows all cases with no Clear All when unfiltered');   // text "All cases, no filters"; no button "Clear All"
it('shows a tag and the count when filtered');             // "Race: black or african american", "334", "of 1,000 cases"
it('clears the filters');                                  // click "Clear All" -> selectSelectedCohortFilterSet root is {}
it('links to Cohort Builder');                             // link "Cohort Builder" href "/?app=CohortBuilder"
it('shows no number or line when a count fails');          // currentData undefined -> no meter; tags still show
it.each([[334, 1000, 33.4], [0, 1000, 0], [5, 0, undefined], [undefined, 1000, undefined], [1200, 1000, 100]])(
  'cohortShare(%s, %s) is %s', (cases, total, share) => expect(cohortShare(cases, total)).toBe(share));
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat/cohortSync src/features/chat/ChatCohortStrip`
Expected: FAIL, `cohortFilterLabels` and `ChatCohortStrip` not defined.

- [ ] **Step 4: Implement**

- Extract `cohortFilterLabels` from `cohortLabel`, keeping the `Selected cases` first. `cohortLabel` becomes `labels.join('; ')`, or `All cases` when there are no entries.
- In `ChatCohortStrip.tsx`, query counts with `useGetCountsQuery` using the same arguments as `useCohortSync.ts:51-57` (`type: COHORT_FILTER_INDEX`, `indexPrefix: 'CaseCentric_'`, `Accessibility.ALL`). Query the total with empty filters and `queryId: 'chat-total'`.
- Layout, 46px tall on `bg-base-lightest`: read-only cohort name in a white pill (`selectCurrentCohortName`), `bg-seashell` tags or the no-filters text, `Clear All` as a text button, then `Cohort Builder` link, then `334` in `font-heading text-lg font-semibold` with `of 1,000 cases`.
- The line is absolutely positioned along the bottom at `h-[3px] bg-base-lighter`, with a `bg-primary` child at `width: ${share}%` and `transition-[width]`. Give the line `role="img"` and `aria-label="334 of 1,000 cases"`. Omit it when `cohortShare` is undefined.
- Show `—` for an unknown count on first load. `currentData` already keeps showing during a refetch only for the same arguments, so hold the last known value in a `useRef`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: the Step 3 command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/cohortSync.ts src/features/chat/cohortSync.unit.test.ts src/features/chat/ChatCohortStrip.tsx src/features/chat/ChatCohortStrip.unit.test.tsx
git commit -m "feat(chat): add the slim cohort strip"
```

### Task 2: Chat-only page frame

**Files:**
- Create: `src/features/chat/ChatHeader.tsx`, `src/features/chat/isChatPage.ts`
- Modify: `src/pages/_app.tsx:70,128`, `src/pages/index.tsx:141-160`, `src/components/analysis/ApplicationWorkspace.tsx:66-73`, `src/features/chat/ChatThread.tsx:107`
- Test: `src/features/chat/isChatPage.unit.test.ts`

**Interfaces:**
- Consumes: `ChatCohortStrip` from Task 1.
- Produces: `isChatPage(pathname: string, app: unknown): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
it.each([
  ['/', 'Chat', true], ['/', 'OncoMatrix', false], ['/', undefined, false],
  ['/cases/1', 'Chat', false], ['/', ['Chat'], false],
])('isChatPage(%s, %s) is %s', (pathname, app, expected) => expect(isChatPage(pathname, app)).toBe(expected));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat/isChatPage`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

- `_app.tsx`: hide `MainNavigation` when `isChatPage(router.pathname, router.query.app)`, and use `p-1 text-xs` on the banner instead of `p-3 text-sm` on that page.
- `index.tsx`: when `isChatPage`, render `<ChatHeader /><ChatCohortStrip />` in place of `CohortManager` and `QueryExpression`. Keep the `projectId` branch for other pages.
- `ChatHeader`: `/images/logos/VirtualLab-R.svg` at 28px height, `Chat` in `font-heading font-semibold text-primary`, and a `next/link` `Close Chat` to `/?app=`. Use `border-b border-base-lighter`.
- `ApplicationWorkspace`: skip `AnalysisBreadcrumbs` when `app === 'Chat'`.
- `ChatThread.tsx:107`: replace `h-[calc(100vh-460px)]` with `h-[calc(100vh-120px)]` and remove the comment about page chrome.

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat`
Expected: PASS, including the existing suites.

- [ ] **Step 5: Check the page in a browser**

With `next dev` and the forwarder running, open `/?app=Chat` at 1440×900. The thread starts within 170px of the top. Then open `/?app=OncoMatrix`, `/?app=CohortBuilder` and `/?app=`, and confirm they have today's navigation, cohort bar and toolbar. Clear All on Chat updates the count.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/ChatHeader.tsx src/features/chat/isChatPage.ts src/features/chat/isChatPage.unit.test.ts src/pages/_app.tsx src/pages/index.tsx src/components/analysis/ApplicationWorkspace.tsx src/features/chat/ChatThread.tsx
git commit -m "feat(chat): replace the page chrome with a slim frame on Chat"
```

### Task 3: Thread, empty state and composer

**Files:**
- Modify: `src/features/chat/ChatThread.tsx`, `src/features/chat/suggestedPrompts.ts`
- Test: `src/features/chat/ChatRuntimeProvider.unit.test.tsx`

**Interfaces:**
- Produces: `SUGGESTED_PROMPTS: ReadonlyArray<{ readonly prompt: string; readonly label: string }>`.

- [ ] **Step 1: Write the failing tests**

Add to `ChatRuntimeProvider.unit.test.tsx`, using that file's stream helpers:

```tsx
it('offers Stop instead of Send while a run is active');   // during a held stream: button "Stop" present, "Send" absent; after RUN_FINISHED: "Send" back
it('asks for a follow-up after the first message');        // textbox placeholder goes from "Ask about the Virtual Lab" to "Ask a follow-up"; accessible name unchanged
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat/ChatRuntimeProvider`
Expected: FAIL, no button named Stop.

- [ ] **Step 3: Implement**

- `SUGGESTED_PROMPTS` keeps its prompt text. Labels in order: `Cohort, then OncoMatrix`, `ProteinPaint`, `Correlation Plot`, `Status check`.
- `COLUMN` becomes `mx-auto w-full max-w-[1200px] px-5`. Remove `[container-type:inline-size]` from the viewport.
- Empty state: `max-w-[720px]` block with a `font-heading text-[34px] font-semibold text-gunmetal` heading, this sentence, and ruled prompt rows: `Ask in plain language. Chat uses this cohort, opens the Virtual Lab's own charts and shows each step it ran.` Each `ThreadPrimitive.Suggestion` gets `aria-label={prompt}`, so its name stays equal to the prompt, with the label in an `aria-hidden` span.
- Question: `font-heading text-2xl font-semibold`, keeping `role="heading" aria-level={3}`.
- Assistant message: remove the left rule and add `text-[15px]`.
- Composer: rounded box with a soft shadow. Show `ComposerPrimitive.Cancel` labelled `Stop` when `s.thread.isRunning`, otherwise `Send`. Placeholder as in the test, `aria-label` fixed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/ChatThread.tsx src/features/chat/suggestedPrompts.ts src/features/chat/ChatRuntimeProvider.unit.test.tsx
git commit -m "feat(chat): restyle the thread, empty state and composer"
```

### Task 4: Tool steps, chart frame and answer sections

**Files:**
- Modify: `src/features/chat/tools/ToolCallRow.tsx:97-135`, `src/features/chat/tools/ChartFrame.tsx`, `src/features/chat/tools/OncoMatrixToolUI.tsx`, `src/features/chat/tools/LollipopToolUI.tsx`, `src/features/chat/tools/SurvivalToolUI.tsx`, `src/features/chat/MarkdownText.tsx`
- Create: `src/features/chat/answerSections.ts`
- Test: `src/features/chat/tools/ToolCallRow.unit.test.tsx`, `src/features/chat/tools/ChartFrame.unit.test.tsx`, `src/features/chat/answerSections.unit.test.ts`

**Interfaces:**
- Produces:
  - `ChartFrameProps` gains `title?: string` and `footer?: React.ReactNode`.
  - `ToolRowProps` and `ChartFrameProps` gain `toolCallId?: string`. Task 5 uses it. Add it here and pass it from every tool UI.
  - `splitAnswerSections(text: string): { readonly preamble: string; readonly sections: ReadonlyArray<AnswerSection> }`, where `AnswerSection = { readonly label: 'Observed' | 'Limits' | 'Interpretation'; readonly body: string }`.

- [ ] **Step 1: Write the failing tests**

`answerSections.unit.test.ts`:

```ts
it.each([
  'Observed: 148 samples', '**Observed:** 148 samples', '**Observed**: 148 samples',
  '## Observed\n148 samples', 'Observed\n148 samples', '**Observed**\n148 samples',
])('finds the label in %j', (text) => {
  expect(splitAnswerSections(text)).toEqual({ preamble: '', sections: [{ label: 'Observed', body: '148 samples' }] });
});

it('splits every section and keeps text before them', () => {
  expect(splitAnswerSections('Now using: All cases.\nObserved: a\nmore\nLimits: b\nInterpretation: c')).toEqual({
    preamble: 'Now using: All cases.',
    sections: [
      { label: 'Observed', body: 'a\nmore' }, { label: 'Limits', body: 'b' }, { label: 'Interpretation', body: 'c' },
    ],
  });
});

it.each(['Limits of this cohort are unclear.', 'Observed results vary.', '- Limits: in a list', 'Obser'])(
  'leaves %j as prose', (text) => expect(splitAnswerSections(text)).toEqual({ preamble: text, sections: [] }));
```

`ToolCallRow.unit.test.tsx`, keeping every existing test:

```tsx
it.each([['Running', true], ['Done', false], ['Failed', true]])('shows the %s status as text', (status, visible) => {
  render(<ToolRow title="Step" status={status as ToolStatus} />);
  expect(screen.getByText(status).classList.contains('sr-only')).toBe(!visible);
});
it('names the settings Inputs');   // <summary> text is "Inputs"
```

`ChartFrame.unit.test.tsx`, mocking `../useCohortSync` (`useCohortFilterForRevision`) and `useAuiState`:

```tsx
it('captions the chart with its title and the cohort it ran on'); // "OncoMatrix", "on Race: x, 334 cases"
it('renders the footer under the chart');                         // footer node present when the filter is known
it('keeps the missing-cohort note');                              // no filter, not running: "This chart's cohort is no longer available"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat/answerSections src/features/chat/tools/ToolCallRow src/features/chat/tools/ChartFrame`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `splitAnswerSections`: a label line is optional `#` markers, optional `**` or `__`, the label, then either a colon (with or without the closing bold before it) followed by optional text, or the end of the line. Matching is case-insensitive. Trim each body.
- `ToolRow`: `data-tool-step` root with `relative pl-6 py-1.5 rounded-md`. Add a dot span: `bg-primary` for Done, hollow `border-2 border-primary motion-safe:animate-pulse` for Running, `bg-rust` for Failed. Draw the connector with `[[data-tool-step]+&]:before:` as a 1px line up to the previous dot. The title stays `font-heading font-semibold`, with the status beside it. Done is `sr-only`. Rename `Details` to `Inputs`. Keep the failure behaviour.
- `CohortToolUI`: change `animate-pulse` to `motion-safe:animate-pulse`.
- `ChartFrame`: drop the `cq` calculations. Use `my-3 rounded-[10px] border border-base-lighter overflow-hidden`. The caption is `<b>{title}</b> on {label}, {n} cases` on a `bg-[#fbfafa]` header. Keep `cohortText`'s count formatting. The footer has `border-t` and padding.
- Tool UIs: pass `title` and `toolCallId`. `OncoMatrixToolUI` passes `FollowUps` as `footer`. Update `ToolSuggestion` styles to a plum outlined pill in `CHAT_BUTTON`, keeping its props.
- `MarkdownText`: call `splitAnswerSections`. Render the preamble as today. Render each section in `grid grid-cols-[96px_1fr] gap-x-3 max-md:grid-cols-1 max-w-[760px]` with a `font-heading text-[12.5px] font-semibold` label, and its body through the same `ReactMarkdown` props. `Limits` uses `text-[13px] text-base-content-dark`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat`
Expected: PASS, including `useCohortSync` and `SurvivalToolUI`.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/answerSections.ts src/features/chat/answerSections.unit.test.ts src/features/chat/MarkdownText.tsx src/features/chat/tools
git commit -m "feat(chat): show tool steps as a rail and label answer sections"
```

### Task 5: Number links

**Files:**
- Create: `src/features/chat/numberLinks.ts`, `src/features/chat/ChatEvidence.tsx`, `src/features/chat/tools/toolResult.ts`
- Modify: `src/features/chat/tools/ToolCallRow.tsx:9-16`, `src/features/chat/tools/ChartFrame.tsx`, `src/features/chat/MarkdownText.tsx`, `src/features/chat/ChatThread.tsx`
- Test: `src/features/chat/numberLinks.unit.test.ts`, `src/features/chat/ChatEvidence.unit.test.tsx`

**Interfaces:**
- Consumes: `toolCallId` on `ToolRow` and `ChartFrame` from Task 4.
- Produces:
  - `extractNumbers(text: string): ReadonlyArray<NumberToken>`, where `NumberToken = { raw: string; value: string; start: number; end: number }`.
  - `toolSources(parts: ReadonlyArray<unknown>): ReadonlyArray<ToolSource>`, where `ToolSource = { toolCallId: string; title: string; summary: string }`.
  - `numberSources(tools: ReadonlyArray<ToolSource>): ReadonlyMap<string, ReadonlyArray<ToolSource>>`, keyed by normalised value.
  - `linkableSources(parts: ReadonlyArray<unknown>, status: { type: string } | undefined)`: `numberSources(toolSources(parts))` when `status?.type === 'complete'`, otherwise an empty map.
  - `linkChildren(children: React.ReactNode, sources): React.ReactNode` and `ChatEvidenceProvider`, `useEvidenceHighlighted(toolCallId?: string): boolean`.
  - `evidenceElementId(toolCallId: string): string`.

- [ ] **Step 1: Write the failing tests**

`numberLinks.unit.test.ts`:

```ts
const values = (text: string) => extractNumbers(text).map((n) => n.value);

it('normalises commas', () => expect(values('1,000 → 334 cases')).toEqual(['1000', '334']));
it('reads brackets and sentence ends', () => expect(values('p.Q61H (38), TP53 38.')).toEqual(['38', '38']));
it('keeps decimals and exponents whole', () => expect(values('p = 7.1e-60 and 0.5')).toEqual(['7.1e-60', '0.5']));
it.each(['p.G12V', 'c.238+2T>C', 'SYNTH-CASE-0001', '1,000a', 'hg38', 'ENSG00000133703'])(
  'skips %s', (text) => expect(values(text)).toEqual([]));

const tool = (toolCallId: string, summary: unknown, toolName = 'virtual-lab___show_oncomatrix') => ({
  type: 'tool-call', toolCallId, toolName, result: JSON.stringify({ status: 'ok', summary }),
});

it('finds every step whose summary has the number', () => {
  const map = numberSources(toolSources([
    tool('a', 'The cohort went from 1000 to 334 cases.', 'virtual-lab___update_cohort'),
    tool('b', '334 cases, 287 samples with a mutation in these genes.'),
  ]));
  expect(map.get('334')?.map((s) => s.toolCallId)).toEqual(['a', 'b']);
  expect(map.get('287')?.map((s) => s.title)).toEqual(['OncoMatrix']);
  expect(map.get('999')).toBeUndefined();
});

it('ignores results with no usable summary', () => {
  expect(toolSources([
    { type: 'tool-call', toolCallId: 'x', toolName: 't', result: 'not json' },
    { type: 'tool-call', toolCallId: 'y', toolName: 't' },
    { type: 'text', text: '148' },
    tool('z', 12),
  ])).toEqual([]);
});

it('adds no links until the message finishes', () => {
  const parts = [tool('a', '148 samples')];
  expect(linkableSources(parts, { type: 'running' }).size).toBe(0);
  expect(linkableSources(parts, undefined).size).toBe(0);
  expect(linkableSources(parts, { type: 'complete' }).size).toBe(1);
});
```

`ChatEvidence.unit.test.tsx`:

```tsx
it('turns only matched numbers into named buttons');   // "148 and 999": button "148, from OncoMatrix"; 999 plain text
it('names every source');                              // "334, from Cohort Builder and OncoMatrix"
it('highlights sources on hover and focus, clears on leave'); // useEvidenceHighlighted('a') true during hover
it('scrolls to the first source on click');            // scrollIntoView called on #evidenceElementId('a')
it('walks into element children');                     // <strong>148</strong> is linked
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat/numberLinks src/features/chat/ChatEvidence`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

The token pattern, which the tests above pin:

```ts
const NUMBER = /(?<![\p{L}\p{N}_.+\-=>*])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\p{L}\p{N}_]|[.,]\d)/gu;
```

- Tool titles: `update_cohort` is `Cohort Builder`, `show_oncomatrix` is `OncoMatrix`, `show_lollipop` is `ProteinPaint`, `show_survival` is `Correlation Plot`. Others use `displayToolName`. To avoid a cycle, put `parseResult` and `displayToolName` in `tools/toolResult.ts` and re-export them from `ToolCallRow.tsx`.
- `ChatEvidence.tsx` holds the provider, the hook, `evidenceElementId`, the number button and `linkChildren`. The button is `type="button"` with `bg-[#fff1e6] border-b border-primary font-mono text-[.92em]`, and hover and focus invert to `bg-primary text-white`. Its `aria-label` is `` `${raw}, from ${titles joined with " and "}` ``. Click uses `scrollIntoView({ block: 'center', behavior })`, with `auto` under reduced motion.
- `linkChildren` maps string children through `extractNumbers`, and recurses into element children only for elements other than `code` and `a`.
- `MarkdownText`: `useAuiState` reads `s.message.parts` and `s.message.status`. Pass `components` overriding `p`, `li`, `strong`, `em`, `td` and `th` to apply `linkChildren`, on section bodies only. Don't override `a` or `code`, so those stay plain. When the map is empty, pass no overrides. Memoise on the parts and status.
- `ToolRow` and `ChartFrame`: set `id={evidenceElementId(toolCallId)}` when given. When highlighted, `ToolRow` gets `bg-seashell` and `ChartFrame` gets `ring-2 ring-primary`.
- `ChatThread`: wrap the viewport in `ChatEvidenceProvider`. The hook returns `false` without a provider, so existing `ToolRow` tests still pass.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/numberLinks.ts src/features/chat/numberLinks.unit.test.ts src/features/chat/ChatEvidence.tsx src/features/chat/ChatEvidence.unit.test.tsx src/features/chat/tools src/features/chat/MarkdownText.tsx src/features/chat/ChatThread.tsx
git commit -m "feat(chat): link answer numbers to the steps they came from"
```

### Task 6: Verify on the running app

**Files:**
- Modify: only what these checks show is wrong. The column width in `ChatThread.tsx` is the expected one.

The user must first refresh the `workshop` credentials and restart `next dev`. Until then Chat returns `HTTP 502`, so ask rather than working around it.

- [ ] **Step 1: Run the static checks**

Run: `NODE_OPTIONS=--no-experimental-strip-types npx jest --runInBand src/features/chat && npm run lint && npx tsc --noEmit`
Expected: tests pass, with no new lint or type errors compared with `origin/main`.

- [ ] **Step 2: Run the demo script in a browser at 1440×900**

Follow "Demonstrating this in chat" in `user-journey/user-journey-cohort-to-lollipop.md`. Confirm:
- The thread starts within 170px of the top.
- The main flow: 1,000 → 334 with Undo, OncoMatrix, Lollipop for KRAS.
- Neither chart scrolls sideways. If one does, widen `COLUMN` and re-check.
- Observed and Limits render as sections on real agent text. If the format differs, add the real form to the `splitAnswerSections` tests and fix it.
- Numbers link and highlight their steps.
- `Only Hispanic patients`, `Show a Lollipop plot for BRCA1` and a failed step read correctly.
- Undo, Clear All followed by a new question ("Now using") and Stop all work.

- [ ] **Step 3: Check the rest of the platform**

Run: `npm run build`. Expected: succeeds.
Open `/?app=`, `/?app=CohortBuilder` and `/?app=OncoMatrix`. They keep today's chrome. Check Chat at 390px wide: strip wraps, answer labels stack.

- [ ] **Step 4: Commit any fixes**

```bash
git add <the files changed>
git commit -m "fix(chat): adjust the Protocol look after checking the live flow"
```
