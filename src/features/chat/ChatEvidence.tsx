import React, { createContext, useContext, useMemo, useState } from 'react';
import { extractNumbers, type NumberSources, type ToolSource } from './numberLinks';

interface Evidence {
  readonly highlighted: ReadonlySet<string>;
  readonly highlight: (toolCallIds: ReadonlyArray<string>) => void;
}

const EvidenceContext = createContext<Evidence | null>(null);

/** Holds which tool steps the number under the pointer or keyboard came from. */
export const ChatEvidenceProvider: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => {
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());
  const value = useMemo(
    () => ({ highlighted, highlight: (ids: ReadonlyArray<string>) => setHighlighted(new Set(ids)) }),
    [highlighted],
  );
  return <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>;
};

export const useEvidenceHighlighted = (toolCallId?: string): boolean => {
  const evidence = useContext(EvidenceContext);
  return toolCallId !== undefined && Boolean(evidence?.highlighted.has(toolCallId));
};

export const evidenceElementId = (toolCallId: string) => `chat-step-${toolCallId}`;

const scrollToStep = (toolCallId: string) => {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById(evidenceElementId(toolCallId))
    ?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
};

interface EvidenceNumberProps {
  readonly raw: string;
  readonly sources: ReadonlyArray<ToolSource>;
}

const EvidenceNumber: React.FC<EvidenceNumberProps> = ({ raw, sources }) => {
  const evidence = useContext(EvidenceContext);
  const ids = sources.map((source) => source.toolCallId);
  const titles = [...new Set(sources.map((source) => source.title))].join(' and ');
  return (
    <button
      type="button"
      aria-label={`${raw}, from ${titles}`}
      className="rounded-t-[3px] border-b border-primary bg-[#fff1e6] px-[3px] font-mono text-[.92em] font-medium text-secondary hover:bg-primary hover:text-white focus-visible:bg-primary focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      onMouseEnter={() => evidence?.highlight(ids)}
      onMouseLeave={() => evidence?.highlight([])}
      onFocus={() => evidence?.highlight(ids)}
      onBlur={() => evidence?.highlight([])}
      onClick={() => scrollToStep(ids[0])}
    >
      {raw}
    </button>
  );
};

const linkText = (text: string, sources: NumberSources): React.ReactNode => {
  const nodes: React.ReactNode[] = [];
  let position = 0;
  for (const { raw, value, start, end } of extractNumbers(text)) {
    const found = sources.get(value);
    if (found) {
      nodes.push(text.slice(position, start), <EvidenceNumber key={start} raw={raw} sources={found} />);
      position = end;
    }
  }
  if (position === 0) return text;
  nodes.push(text.slice(position));
  return nodes;
};

const UNLINKED_ELEMENTS: ReadonlyArray<unknown> = ['a', 'code', EvidenceNumber];

/** Wraps numbers found in a tool's summary in a button. Links and code stay as they are. */
export const linkChildren = (children: React.ReactNode, sources: NumberSources): React.ReactNode =>
  React.Children.map(children, (child) => {
    if (typeof child === 'string') return linkText(child, sources);
    if (!React.isValidElement<{ children?: React.ReactNode }>(child) || UNLINKED_ELEMENTS.includes(child.type)) {
      return child;
    }
    return React.cloneElement(child, undefined, linkChildren(child.props.children, sources));
  });
