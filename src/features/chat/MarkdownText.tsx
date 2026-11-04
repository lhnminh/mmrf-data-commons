import React from 'react';
import type { TextMessagePartComponent } from '@assistant-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const REMARK_PLUGINS = [remarkGfm];
// Agent text shouldn't make the browser load remote images. Raw HTML is already not rendered.
const DISALLOWED_ELEMENTS = ['img'];

/** Renders the agent's Markdown answers. */
const MarkdownText: TextMessagePartComponent = ({ text }) => (
  <div className="prose prose-sm max-w-none overflow-x-auto font-content">
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      disallowedElements={DISALLOWED_ELEMENTS}
    >
      {text}
    </ReactMarkdown>
  </div>
);

export default MarkdownText;
