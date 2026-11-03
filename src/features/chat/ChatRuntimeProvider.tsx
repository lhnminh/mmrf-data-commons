import React from 'react';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { previewAdapter } from './previewAdapter';

interface ChatRuntimeProviderProps {
  readonly children: React.ReactNode;
}

const ChatRuntimeProvider: React.FC<ChatRuntimeProviderProps> = ({
  children,
}: ChatRuntimeProviderProps) => {
  const runtime = useLocalRuntime(previewAdapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
};

export default ChatRuntimeProvider;
