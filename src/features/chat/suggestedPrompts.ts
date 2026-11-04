export interface SuggestedPrompt {
  readonly prompt: string;
  /** The tools this prompt uses. */
  readonly label: string;
}

export const SUGGESTED_PROMPTS: ReadonlyArray<SuggestedPrompt> = [
  { prompt: "What's mutated in Black patients?", label: 'Cohort, then OncoMatrix' },
  { prompt: 'Show a Lollipop plot for KRAS', label: 'ProteinPaint' },
  { prompt: 'Compare survival for CGS high risk vs standard risk', label: 'Correlation Plot' },
  { prompt: 'Is the Virtual Lab healthy?', label: 'Status check' },
];
