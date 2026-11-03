import React, { useMemo } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useAgUiRuntime } from '@assistant-ui/react-ag-ui';
import { HttpAgent } from '@ag-ui/client';

export const AGENT_ROUTE = '/api/agent/agui';

interface ChatRuntimeProviderProps {
  readonly children: React.ReactNode;
}

const ChatRuntimeProvider: React.FC<ChatRuntimeProviderProps> = ({
  children,
}: ChatRuntimeProviderProps) => {
  const agent = useMemo(() => new HttpAgent({ url: AGENT_ROUTE }), []);
  const runtime = useAgUiRuntime({ agent });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
};

export default ChatRuntimeProvider;
