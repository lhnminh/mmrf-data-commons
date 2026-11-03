import type { SurvivalElement } from '@/core/features/survival/types';

/** Survival result from the agent's correlation_plot tool. */
export interface CorrelationPlot {
  readonly type: 'survival';
  readonly unit: string;
  readonly labels: ReadonlyArray<string>;
  readonly counts: ReadonlyArray<number>;
  readonly survivalData: ReadonlyArray<SurvivalElement>;
  readonly overallStats: Record<string, number | undefined>;
}

export interface AgentToolResult {
  readonly summary: string;
  readonly plot?: unknown;
}

export interface AgentToolCall {
  readonly name: string;
  readonly input: Readonly<Record<string, string | number | boolean | null>>;
  readonly status: 'started' | 'success' | 'error';
  readonly result?: AgentToolResult;
  readonly error?: string;
}

/** Response from the agent's POST /v1/prompts. */
export interface AgentResponse {
  readonly message: string;
  readonly toolCalls: ReadonlyArray<AgentToolCall>;
}

const UNFINISHED_TOOL = 'The tool did not finish.';

const toToolPart = (
  call: AgentToolCall,
  index: number,
  recorded: boolean,
) => {
  const part = {
    type: 'tool-call' as const,
    toolCallId: `${call.name}-${index}`,
    toolName: call.name,
    args: call.input,
    argsText: JSON.stringify(call.input),
  };
  if (call.status === 'success') {
    return { ...part, result: recorded ? { ...call.result, recorded } : call.result };
  }
  // Every part needs a result, or the run would never end.
  return {
    ...part,
    isError: true,
    result: { error: call.status === 'error' ? call.error : UNFINISHED_TOOL },
  };
};

export const toMessageContent = (
  response: AgentResponse,
  { recorded = false }: { recorded?: boolean } = {},
) => [
  ...response.toolCalls.map((call, index) => toToolPart(call, index, recorded)),
  ...(response.message
    ? [{ type: 'text' as const, text: response.message }]
    : []),
];
