import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { createAgentProxyHandler, regionFromRuntimeArn } from '@/lib/agentRuntime/proxy';

export const config = { api: { bodyParser: false, responseLimit: false } };

const runtimeArn = process.env.AGENTCORE_RUNTIME_ARN;

export default createAgentProxyHandler({
  nodeEnv: process.env.NODE_ENV,
  runtimeArn,
  invoke: async ({ agentRuntimeArn, runtimeSessionId, payload, abortSignal }) => {
    const client = new BedrockAgentCoreClient({ region: regionFromRuntimeArn(agentRuntimeArn) });
    const result = await client.send(
      new InvokeAgentRuntimeCommand({
        agentRuntimeArn,
        runtimeSessionId,
        payload: new TextEncoder().encode(payload),
        contentType: 'application/json',
        accept: 'text/event-stream',
      }),
      { abortSignal },
    );
    return result.response as unknown as AsyncIterable<Uint8Array>;
  },
  // Logged on this machine only; never returned to the browser.
  log: (message, error) => console.error(`[agent route] ${message}`, error ?? ''),
});
