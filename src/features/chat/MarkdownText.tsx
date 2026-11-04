import React, { useMemo } from 'react';
import { useAuiState, type TextMessagePartComponent } from '@assistant-ui/react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitAnswerSections } from './answerSections';
import { linkChildren } from './ChatEvidence';
import { linkableSourcesKey, numberSources, type NumberSources, type ToolSource } from './numberLinks';

const REMARK_PLUGINS = [remarkGfm];
// Agent text shouldn't make the browser load remote images. Raw HTML is already not rendered.
const DISALLOWED_ELEMENTS = ['img'];

const Markdown: React.FC<{ readonly text: string; readonly components?: Components }> = ({ text, components }) => (
  <div className="prose prose-sm max-w-none overflow-x-auto font-content text-inherit">
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} disallowedElements={DISALLOWED_ELEMENTS} components={components}>
      {text}
    </ReactMarkdown>
  </div>
);

/** Markdown's text blocks, with numbers linked to the steps they came from. */
const linkedComponents = (sources: NumberSources): Components | undefined => {
  if (sources.size === 0) return undefined;
  const linked = (Tag: 'p' | 'li' | 'td' | 'th') => {
    const Element = Tag as React.ElementType;
    const Linked = ({ node: _node, children, ...props }: React.ComponentProps<typeof Tag> & { node?: unknown }) => (
      <Element {...props}>{linkChildren(children, sources)}</Element>
    );
    Linked.displayName = `Linked(${Tag})`;
    return Linked;
  };
  return { p: linked('p'), li: linked('li'), td: linked('td'), th: linked('th') };
};

/** Renders the agent's Markdown answers, with Observed, Limits and Interpretation labelled. */
const MarkdownText: TextMessagePartComponent = ({ text }) => {
  const sourcesKey = useAuiState((s) => linkableSourcesKey(s.thread.messages, s.message.id, s.message.status));
  const components = useMemo(
    () => linkedComponents(numberSources(JSON.parse(sourcesKey) as ReadonlyArray<ToolSource>)),
    [sourcesKey],
  );
  const { preamble, sections } = splitAnswerSections(text);

  return (
    <>
      {/* Text with no labels is the whole answer. Text before labels is a note about it. */}
      {preamble && <Markdown text={preamble} components={sections.length === 0 ? components : undefined} />}
      {sections.map(({ label, body }) => (
        <section
          key={label}
          className={`mt-2.5 grid max-w-[760px] grid-cols-[96px_1fr] gap-x-3 max-md:grid-cols-1 ${
            label === 'Limits' ? 'text-[13px] text-gunmetal/70' : ''
          }`}
        >
          <h4 className="m-0 font-heading text-[12.5px] font-semibold leading-6 text-gunmetal">{label}</h4>
          <Markdown text={body} components={components} />
        </section>
      ))}
    </>
  );
};

export default MarkdownText;
