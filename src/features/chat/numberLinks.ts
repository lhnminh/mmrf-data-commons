import { displayToolName, parseResult } from './tools/toolResult';

export interface NumberToken {
  readonly raw: string;
  /** Without thousands separators, so 1,000 and 1000 match. */
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

export interface ToolSource {
  readonly toolCallId: string;
  readonly title: string;
  readonly summary: string;
}

export type NumberSources = ReadonlyMap<string, ReadonlyArray<ToolSource>>;

// Not part of an identifier such as p.G12V, c.238+2T>C or SYNTH-CASE-0001.
const NUMBER =
  /(?<![\p{L}\p{N}_.+\-=>*])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\p{L}\p{N}_]|[.,]\d)/gu;

const TOOL_TITLES: Record<string, string> = {
  update_cohort: 'Cohort Builder',
  show_oncomatrix: 'OncoMatrix',
  show_lollipop: 'ProteinPaint',
  show_survival: 'Correlation Plot',
};

export const extractNumbers = (text: string): ReadonlyArray<NumberToken> =>
  Array.from(text.matchAll(NUMBER), (match) => ({
    raw: match[0],
    value: match[0].replaceAll(',', ''),
    start: match.index,
    end: match.index + match[0].length,
  }));

interface TurnMessage {
  readonly id: string;
  readonly role: string;
  readonly content: ReadonlyArray<unknown>;
}

/**
 * Every part of a turn up to and including this message. The agent's stream gives a turn's tool
 * calls and its answer different message IDs, so they can arrive as separate messages.
 */
export const turnParts = (messages: ReadonlyArray<TurnMessage>, messageId: string): ReadonlyArray<unknown> => {
  const end = messages.findIndex((message) => message.id === messageId);
  if (end < 0) return [];
  const start = messages.slice(0, end).findLastIndex((message) => message.role === 'user') + 1;
  return messages.slice(start, end + 1).flatMap((message) => message.content);
};

/** The finished tool calls among these parts that have a summary to link to. */
export const toolSources = (parts: ReadonlyArray<unknown>): ReadonlyArray<ToolSource> =>
  parts.flatMap((part) => {
    const { type, toolCallId, toolName, result } = (part ?? {}) as Record<string, unknown>;
    if (type !== 'tool-call' || typeof toolCallId !== 'string' || typeof toolName !== 'string') return [];
    const summary = (parseResult(result) as { summary?: unknown } | null | undefined)?.summary;
    if (typeof summary !== 'string') return [];
    const name = displayToolName(toolName);
    return [{ toolCallId, title: TOOL_TITLES[name] ?? name, summary }];
  });

export const numberSources = (tools: ReadonlyArray<ToolSource>): NumberSources => {
  const sources = new Map<string, ToolSource[]>();
  for (const tool of tools) {
    for (const value of new Set(extractNumbers(tool.summary).map((number) => number.value))) {
      sources.set(value, [...(sources.get(value) ?? []), tool]);
    }
  }
  return sources;
};

/**
 * A turn's linkable sources as a string, once the message has finished, so links don't reflow
 * text as it streams. `thread.messages` changes with every streamed token, so
 * selecting this instead keeps a finished answer from rendering, and remounting, each time.
 */
export const linkableSourcesKey = (
  messages: ReadonlyArray<TurnMessage>,
  messageId: string,
  status: { readonly type: string } | undefined,
): string => JSON.stringify(status?.type === 'complete' ? toolSources(turnParts(messages, messageId)) : []);
