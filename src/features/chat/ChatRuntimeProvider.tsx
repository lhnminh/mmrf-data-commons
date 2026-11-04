import React, { useMemo } from 'react';
import { AssistantRuntimeProvider, AuiConfig, Tools } from '@assistant-ui/react';
import { useAgUiRuntime } from '@assistant-ui/react-ag-ui';
import { HttpAgent } from '@ag-ui/client';
import { toolkit } from './toolkit';
import { CohortProvider } from './useCohortSync';

export const AGENT_ROUTE = '/api/agent/agui';

const TOOLS_CONFIG = AuiConfig({ tools: Tools({ toolkit }) });

interface ChatRuntimeProviderProps {
  readonly children: React.ReactNode;
}

const ChatRuntimeProvider: React.FC<ChatRuntimeProviderProps> = ({
  children,
}: ChatRuntimeProviderProps) => {
  const agent = useMemo(() => new HttpAgent({ url: AGENT_ROUTE }), []);
  const runtime = useAgUiRuntime({ agent });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={TOOLS_CONFIG}>
      <CohortProvider agent={agent}>{children}</CohortProvider>
    </AssistantRuntimeProvider>
  );
};

export default ChatRuntimeProvider;
