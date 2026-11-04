import React from 'react';
import type { TextMessagePartComponent } from '@assistant-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitAnswerSections } from './answerSections';

const REMARK_PLUGINS = [remarkGfm];
// Agent text shouldn't make the browser load remote images. Raw HTML is already not rendered.
const DISALLOWED_ELEMENTS = ['img'];

const Markdown: React.FC<{ readonly text: string }> = ({ text }) => (
  <div className="prose prose-sm max-w-none overflow-x-auto font-content text-inherit">
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} disallowedElements={DISALLOWED_ELEMENTS}>
      {text}
    </ReactMarkdown>
  </div>
);

/** Renders the agent's Markdown answers, with Observed, Limits and Interpretation labelled. */
const MarkdownText: TextMessagePartComponent = ({ text }) => {
  const { preamble, sections } = splitAnswerSections(text);
  return (
    <>
      {preamble && <Markdown text={preamble} />}
      {sections.map(({ label, body }) => (
        <section
          key={label}
          className={`mt-2.5 grid max-w-[760px] grid-cols-[96px_1fr] gap-x-3 max-md:grid-cols-1 ${
            label === 'Limits' ? 'text-[13px] text-base-content-dark' : ''
          }`}
        >
          <h4 className="m-0 font-heading text-[12.5px] font-semibold leading-6 text-gunmetal">{label}</h4>
          <Markdown text={body} />
        </section>
      ))}
    </>
  );
};

export default MarkdownText;
