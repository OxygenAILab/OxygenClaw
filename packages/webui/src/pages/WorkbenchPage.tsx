import React, { useState } from 'react';
import {
  useConversation,
  useCreateConversation,
  useSendMessage,
} from '../features/conversations/hooks/useConversations';
import { useSSEChat } from '../features/conversations/hooks/useSSEChat';
import { ConversationList } from '../features/conversations/components/ConversationList';
import { MessageList } from '../features/conversations/components/MessageList';
import { ChatInput } from '../features/conversations/components/ChatInput';
import { SSEStatusIndicator } from '../components/SSEStatusIndicator';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { Conversation } from '../api/types';

const WorkbenchPage: React.FC = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const createMutation = useCreateConversation();
  const sendMessageMutation = useSendMessage();

  const {
    data: conversationDetail,
    isLoading: isLoadingConversation,
    error: conversationError,
  } = useConversation(selectedConversationId, {
    includeMessages: true,
  });

  const {
    isStreaming,
    events: streamingEvents,
    error: streamingError,
    startStreaming,
    stopStreaming,
  } = useSSEChat({
    conversationId: selectedConversationId || '',
    onComplete: () => {
      console.log('Streaming completed');
    },
    onError: (error) => {
      console.error('Streaming error:', error);
    },
  });

  const handleNewChat = async () => {
    try {
      const newConversation = await createMutation.mutateAsync({
        mode: 'chat',
        capability: 'fast',
        modelId: 'anthropic:claude-3-5-sonnet-20241022',
        title: '新会话',
      });
      setSelectedConversationId(newConversation.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    stopStreaming();
    setSelectedConversationId(conversation.id);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedConversationId) {
      await handleNewChat();
      return;
    }

    try {
      const response = await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        data: {
          content,
          generate: true,
        },
      });

      // After Lot 4 P1-2: response contains taskId for SSE streaming
      if (response.taskId) {
        startStreaming(response.taskId);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#F7F4EF]">
        {/* Left sidebar: Conversation list */}
        <div className="w-80 flex-shrink-0">
          <ConversationList
            selectedId={selectedConversationId || undefined}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Right panel: Chat area */}
        <div className="flex-1 flex flex-col">
          {selectedConversationId ? (
            <>
              {/* Header */}
              <div className="border-b border-[#E7E1D7] bg-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-medium text-[#1F2421]">
                      {conversationDetail?.conversation.title || '新会话'}
                    </h1>
                    {conversationDetail?.conversation.mode && (
                      <span className="inline-block mt-1 px-3 py-1 text-sm bg-[#F2E3D6] text-[#C4612F] rounded-full">
                        {conversationDetail.conversation.mode}
                      </span>
                    )}
                  </div>
                  <SSEStatusIndicator
                    isConnected={isStreaming}
                    error={streamingError}
                  />
                </div>
              </div>

              {/* Messages */}
              {isLoadingConversation ? (
                <div className="flex-1 flex items-center justify-center text-[#5C635D]">
                  加载中...
                </div>
              ) : conversationError ? (
                <div className="flex-1 flex items-center justify-center text-red-500">
                  加载失败: {conversationError.message}
                </div>
              ) : (
                <MessageList
                  messages={conversationDetail?.messages || []}
                  streamingEvents={streamingEvents}
                  isStreaming={isStreaming}
                />
              )}

              {/* Input */}
              <ChatInput
                onSend={handleSendMessage}
                disabled={isStreaming || sendMessageMutation.isPending}
                placeholder={isStreaming ? '处理中，请稍候...' : '输入消息...'}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="max-w-md">
                <h2 className="text-2xl font-medium text-[#1F2421] mb-4">
                  欢迎使用 <span className="italic text-[#C4612F]">OxygenClaw</span>
                </h2>
                <p className="text-[#5C635D] mb-8">
                  选择左侧会话或创建新会话开始对话
                </p>
                <button
                  onClick={handleNewChat}
                  className="px-8 py-3 bg-[#C4612F] text-white rounded-full hover:bg-[#A94E22] transition-colors"
                >
                  开始新会话
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default WorkbenchPage;
