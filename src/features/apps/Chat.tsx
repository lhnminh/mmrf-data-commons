import React from 'react';
import ChatRuntimeProvider from '@/features/chat/ChatRuntimeProvider';
import ChatThread from '@/features/chat/ChatThread';

const ChatApp: React.FC = () => (
  <ChatRuntimeProvider>
    <ChatThread />
  </ChatRuntimeProvider>
);

export default ChatApp;
