import React from 'react';
import * as webStreams from 'node:stream/web';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatRuntimeProvider, { AGENT_ROUTE } from './ChatRuntimeProvider';
import ChatThread from './ChatThread';

// The Markdown packages are ES modules outside this test's concern; plain text is enough here.
jest.mock('./MarkdownText', () => {
  const { MessagePartPrimitive } = jest.requireActual('@assistant-ui/react');
  return { __esModule: true, default: () => <MessagePartPrimitive.Text /> };
});

const FULL_TOOL_NAME = 'virtual-lab___check_virtual_lab_health';

const ids = { threadId: 't', runId: 'r', messageId: 'm', toolCallId: 'c' };

const SUCCESSFUL_RUN = [
  { type: 'RUN_STARTED', threadId: ids.threadId, runId: ids.runId },
  { type: 'TOOL_CALL_START', toolCallId: ids.toolCallId, toolCallName: FULL_TOOL_NAME },
  { type: 'TOOL_CALL_ARGS', toolCallId: ids.toolCallId, delta: '{}' },
  { type: 'TOOL_CALL_END', toolCallId: ids.toolCallId },
  {
    type: 'TOOL_CALL_RESULT',
    messageId: 'tool-result',
    toolCallId: ids.toolCallId,
    content: '{"ok":true,"cases":1000}',
  },
  { type: 'TEXT_MESSAGE_START', messageId: ids.messageId, role: 'assistant' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: ids.messageId, delta: 'The lab reports ' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: ids.messageId, delta: '1000 synthetic cases.' },
  { type: 'TEXT_MESSAGE_END', messageId: ids.messageId },
  { type: 'RUN_FINISHED', threadId: ids.threadId, runId: ids.runId },
];

const FAILED_RUN = [
  { type: 'RUN_STARTED', threadId: ids.threadId, runId: ids.runId },
  { type: 'RUN_ERROR', code: 'AGENT_ERROR', message: 'The agent could not finish this run.' },
];

const failedToolRun = () =>
  SUCCESSFUL_RUN.map((event) =>
    event.type === 'TOOL_CALL_RESULT'
      ? { ...event, content: '{"ok":false,"error":"auth_failed","summary":"The Virtual Lab refused the login."}' }
      : event,
  );

const sseResponse = (events: ReadonlyArray<object>) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      events.forEach((event) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
      );
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
};

const renderChat = () =>
  render(
    <ChatRuntimeProvider>
      <ChatThread />
    </ChatRuntimeProvider>,
  );

describe('Chat over AG-UI', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    // Browsers have these; jsdom doesn't.
    Object.assign(globalThis, {
      ReadableStream: webStreams.ReadableStream,
      TransformStream: webStreams.TransformStream,
      WritableStream: webStreams.WritableStream,
    });
    Element.prototype.scrollIntoView = jest.fn();
    Element.prototype.scrollTo = jest.fn();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('streams an answer and a tool row from the agent route', async () => {
    const fetchMock = jest.fn().mockResolvedValue(sseResponse(SUCCESSFUL_RUN));
    global.fetch = fetchMock;

    renderChat();
    await userEvent.click(screen.getByRole('button', { name: 'Is the Virtual Lab healthy?' }));

    expect(await screen.findByText(/1000 synthetic cases/)).toBeTruthy();
    expect(screen.getByText('check_virtual_lab_health')).toBeTruthy();
    expect(AGENT_ROUTE).toBe('/api/agent/agui');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/agent/agui');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages.at(-1).role).toBe('user');
  });

  it('marks a finished tool as done', async () => {
    global.fetch = jest.fn().mockResolvedValue(sseResponse(SUCCESSFUL_RUN));

    renderChat();
    await userEvent.click(screen.getByRole('button', { name: 'Is the Virtual Lab healthy?' }));

    expect(await screen.findByText('Done')).toBeTruthy();
    expect(screen.queryByText('Failed')).toBeNull();
  });

  it('marks a tool that reports a failure as failed, with its reason', async () => {
    global.fetch = jest.fn().mockResolvedValue(sseResponse(failedToolRun()));

    renderChat();
    await userEvent.click(screen.getByRole('button', { name: 'Is the Virtual Lab healthy?' }));

    expect(await screen.findByText('Failed')).toBeTruthy();
    expect(screen.getByText('The Virtual Lab refused the login.')).toBeTruthy();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it.each([
    ['an error status', () => Promise.resolve(new Response('{"error":"The agent is unavailable"}', { status: 502 }))],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('shows a plain message when the agent cannot be reached: %s', async (_name, respond) => {
    global.fetch = jest.fn().mockImplementationOnce(respond).mockResolvedValueOnce(sseResponse(SUCCESSFUL_RUN));

    renderChat();
    await userEvent.click(screen.getByRole('button', { name: 'Is the Virtual Lab healthy?' }));

    expect(await screen.findByText('The research agent is unavailable. Please try again.')).toBeTruthy();
    expect(screen.queryByText(/HTTP 502|Failed to fetch/)).toBeNull();

    await userEvent.type(screen.getByRole('textbox', { name: 'Ask about the Virtual Lab' }), 'Again{Enter}');
    await waitFor(() => expect(screen.getByText(/1000 synthetic cases/)).toBeTruthy());
  });

  it('shows a failed run and lets the user send again', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(sseResponse(FAILED_RUN))
      .mockResolvedValueOnce(sseResponse(SUCCESSFUL_RUN));

    renderChat();
    await userEvent.click(screen.getByRole('button', { name: 'Is the Virtual Lab healthy?' }));

    expect(await screen.findByText('The agent could not finish this run.')).toBeTruthy();

    await userEvent.type(screen.getByRole('textbox', { name: 'Ask about the Virtual Lab' }), 'Again{Enter}');
    await waitFor(() => expect(screen.getByText(/1000 synthetic cases/)).toBeTruthy());
  });
});
