# Chat Protocol look: design

**Date:** 2026-11-04
**Status:** awaiting review
**Mockup:** `chat-redesign/index.html` in the hackathon workspace, look "A · Protocol" (not in this repo)

## Goal

Make Chat more attractive and streamlined for the ORION demo, while keeping every tool call and number traceable. A researcher should be able to follow, from across a room, a question becoming a cohort change, a real chart and an answer.

## Success criteria

1. At 1440×900 with Chat open, the thread starts within 170px of the top of the page. Today it starts at about 440px.
2. The main demo flow from `user-journey-cohort-to-lollipop.md` runs end to end in the new look: cohort change with Undo, OncoMatrix, Lollipop for KRAS.
3. The limit cases in that script still read correctly: which-one options, gene not in the dataset, failed step.
4. Selecting a linked number in an answer highlights the step or steps whose summary contains it.
5. Every other Virtual Lab tool looks and behaves as it does today.

## Non-goals

- Changing the agent, tools, Lambda, Terraform or any team API contract.
- Restyling ProteinPaint charts.
- Moving charts out of the message flow. The single-column layout with the tool row first stays.
- Cohort switching, saving, copying, deleting, importing or exporting inside Chat. Those stay in Cohort Builder.
- Adding a new font. The look uses the theme's Montserrat and Noto Sans, plus a monospace stack for tool inputs and linked numbers.

## Page

All changes in this section apply only when `router.query.app === 'Chat'`.

### Header

`src/pages/_app.tsx` renders `MainNavigation` for every route except `/Login`. It also hides the navigation for Chat, and the Chat page renders its own slim header: logo, "Chat" title and a Close Chat link. The link goes to `/?app=`, the Analysis Center, which is where the current close button goes.

The synthetic banner stays visible. Its text doesn't change, because the sandbox's UI tests match it exactly. Chat uses smaller padding through a conditional class.

### Cohort strip

`src/pages/index.tsx` renders a new `src/features/chat/ChatCohortStrip.tsx` for Chat instead of `CohortManager` and `QueryExpression`. `ApplicationWorkspace` also skips `AnalysisBreadcrumbs`, which draws the Chat toolbar, when the app is Chat.

| Element | Source |
| --- | --- |
| Cohort name | `selectCurrentCohortName`. Read-only |
| Filter tags | The current cohort's filter set, one tag per filter, using the existing label logic in `cohortSync.ts`. Exporting a per-filter label function is part of this work |
| No filters | "All cases, no filters" |
| Clear All | `clearCohortFilters({ index })`, shown only when a filter exists |
| Case count | `useGetCountsQuery` with the same arguments as `CountsPanel`, as `useCohortSync.ts` already does. Shows "334 of 1,000 cases" |
| Proportion line | 3px line along the strip's bottom edge. Width is cases divided by the total. It has an accessible label and the count is also written as text |
| Cohort Builder link | `/?app=CohortBuilder` |

The total comes from the same count query with empty filters, so it's a live value rather than a hardcoded 1,000. While either count is loading, the strip shows the last value, or a dash on first load. If a count fails, the strip shows the filters without a number or line.

Changes made by Clear All reach the agent through the existing "changed outside chat" path. The existing "Now using" behaviour doesn't change.

### Thread height

`ThreadPrimitive.Root` fills the remaining viewport height, replacing `h-[calc(100vh-460px)]`. On screens 768px and wider, Chat clips the page to the window, because a page that could scroll moved the cohort strip off screen. The page footer isn't reachable from Chat there, and the strip stays on one line with its tags scrolling sideways.

## Thread

`ChatThread.tsx`, `ToolCallRow.tsx` and `ChartFrame.tsx` keep their primitives and the part order they already render: plan text, tool rows, chart, follow-ups, answer text.

### Layout

- Question, steps and charts share one column, `max-w-[1200px]`. Answer text is capped at about 760px.
- `ChartFrame` drops its `100cqw` width calculation and fills the column. ProteinPaint draws at a fixed size and scrolls sideways when squeezed, so the column width must be checked against the live charts at 1440px wide. If a chart scrolls sideways at that width, widen the column until it doesn't.

### Empty state

A large heading, one sentence, and the prompts as ruled rows. Each prompt shows a short label of the tool it uses, such as "Cohort, then OncoMatrix". `SUGGESTED_PROMPTS` becomes a list of `{ prompt, label }`, and the `prompt` text doesn't change.

### Question

A Montserrat 24px heading. The answer loses its left rule.

### Tool step (`ToolRow`)

A rail step: dot, tool name, result, then a collapsed Inputs disclosure holding the current settings.

| Status | Shows |
| --- | --- |
| Running | Hollow pulsing dot, and the row's detail text |
| Done | Filled plum dot and the result |
| Failed | Rust dot, the word **Failed** and the reason, with Inputs open |

The Done word is visually hidden rather than removed, so screen readers still hear each row's status. Every tool UI, including the fallback for unknown tools, keeps its current data and only changes presentation. Undo stays on the cohort step, and "Undone" keeps its text.

### Chart (`ChartFrame`)

A rounded frame. The caption gives the chart's name and the cohort it ran on, and `FollowUps` moves into the frame's footer. The chart-loading, error and missing-cohort notes stay as they are. The cohort always comes from the tool result, so an older chart keeps its label after the cohort changes.

### Answer sections

A new pure function, `splitAnswerSections(text)`, finds Observed, Limits and Interpretation at the start of a line. It allows Markdown heading or bold markers and a trailing colon. Each section renders with a label column and its body through the existing `ReactMarkdown` settings. Limits uses smaller, muted text.

Text with no recognised label, such as the one-line plan, renders exactly as it does today. Sections appear as text streams, so an unfinished label stays plain text until its line matches.

### Composer

A floating box in `ThreadPrimitive.ViewportFooter`. While a run is active, `ComposerPrimitive.Cancel` replaces Send with Stop. The placeholder is "Ask about the Virtual Lab" on an empty thread and "Ask a follow-up" afterwards.

## Number links

### Matching

A new pure module, `src/features/chat/numberLinks.ts`:

- `extractNumbers(text)` returns numeric tokens, normalised so `1,000` equals `1000`.
- It skips digits that touch letters or sit in identifiers, such as `p.G12V`, `c.238+2T>C` and `SYNTH-CASE-0001`. Decimals and scientific notation like `7.1e-60` count as one token, and a P-value isn't split.
- `numberSources(tools)` takes a turn's tool results and returns, for each number, the tools whose `summary` contains it. The agent's stream gives a turn's tool calls and its answer different message IDs, so sources come from every message since the last question.

### Rendering

`MarkdownText` reads the message's tool parts with `useAuiState`, then overrides the `react-markdown` text elements (`p`, `li`, `strong`, `em`, `td`, `th`) to wrap each matched number in a button. Code and links aren't overridden, so they stay as they are. Numbers with no source remain plain text, so a link always means the number was found in a tool summary.

Links apply to answer sections, or to the whole text when it has no labels, but not to text before labelled sections. A plan line has no sources, because it comes before the turn's tool calls. They're added once the message finishes, so the text doesn't reflow during streaming.

### Highlighting

- A small context, `ChatEvidenceProvider`, holds the set of highlighted `toolCallId`s.
- Hover or focus on a number highlights its sources. Clicking scrolls the first source into view.
- `ToolRow` and `ChartFrame` take a `toolCallId` from the tool part's props and highlight when their ID is in the set.
- Highlighting never depends on colour alone: the chart frame gets a heavier outline and the step gets a filled background.

This is the only feature not yet tried on real agent output. It's built last and sits behind one `MarkdownText` prop, so it can be removed without touching the rest of the look.

## Error handling

- A run error still renders through `ErrorPrimitive` and `chatErrorMessage`, in the answer column.
- Unknown tools use the same rail step through `ToolCallFallback`.
- A malformed tool result produces no number links and doesn't break the message.

## Accessibility and responsiveness

- Visible keyboard focus on every control. Number links are real buttons with an accessible name such as "334, from Cohort Builder".
- Pulsing and scrolling animations respect `prefers-reduced-motion`.
- Below 768px the answer label column stacks above its body, and the strip wraps.

## Testing

Jest, beside the source, with `NODE_OPTIONS=--no-experimental-strip-types`:

- `numberLinks.unit.test.ts`: comma normalisation, tokens to skip, shared numbers, no match, malformed results.
- `answerSections.unit.test.ts`: each label form, no labels, partial streaming text.
- `ChatCohortStrip.unit.test.tsx`: filter tags, Clear All, count loading and failure.
- Update `ToolCallRow.unit.test.tsx` and `SurvivalToolUI.unit.test.tsx` for the new markup, and keep their status, failure and follow-up assertions.
- Add a test that each status renders its text.

Manual, once the agent is back: run the demo script in a browser at 1440×900, including the limit cases, and confirm the chart widths and the real text format of Observed and Limits. Then check that Cohort Builder, OncoMatrix and the Analysis Center still have their normal chrome.

## Risks

| Risk | Handling |
| --- | --- |
| The sandbox's UI scripts rely on the Chat page's chrome | Checked: `scripts/ui-*.mjs` don't open Chat. Their banner check is unaffected because the text is unchanged |
| ProteinPaint needs more width than the column | Checked with live charts, and the column widens |
| The agent's text doesn't follow the section format | Renders as ordinary Markdown |
| Number links mislead on a coincidental match, such as a 6 in another summary | Links are scoped to tool results in the same turn and described as "found in", not as proof |
| Hiding `CohortManager` removes something Chat depends on | `CohortProvider` reads the core store directly. Confirmed by running the cohort flow |

## Build order

1. Page chrome: slim header, cohort strip, thread height.
2. Thread restyle: empty state, question, tool step, chart, composer with Stop.
3. Answer sections.
4. Number links.

Each step leaves Chat working, so the demo can use whichever step is finished.
