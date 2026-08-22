import React, { useEffect, useRef } from 'react';
import type { Message, RuntimeEvent } from '../../../api/types';

interface MessageListProps {
  messages: Message[];
  streamingEvents?: RuntimeEvent[];
  isStreaming?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamingEvents = [],
  isStreaming = false,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingEvents]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {/* Streaming events preview */}
        {isStreaming && streamingEvents.length > 0 && (
          <div className="p-4 bg-[#F2E3D6] rounded-lg border border-[#E7E1D7]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[#C4612F] rounded-full animate-pulse"></div>
              <span className="text-sm text-[#5C635D]">处理中...</span>
            </div>
            <div className="space-y-1 text-xs text-[#5C635D] font-mono">
              {streamingEvents.slice(-5).map((event, idx) => (
                <div key={idx}>
                  [{event.type}] {JSON.stringify(event.payload).slice(0, 100)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          isUser
            ? 'bg-[#C4612F] text-white'
            : 'bg-white border border-[#E7E1D7] text-[#1F2421]'
        }`}
      >
        {/* Role indicator */}
        <div className="text-xs opacity-70 mb-2">
          {isUser ? '你' : 'AI助手'}
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none">
          {Array.isArray(message.content) ? (
            message.content.map((block, idx) => {
              if (block.type === 'text') {
                return (
                  <div key={idx} className="whitespace-pre-wrap">
                    {block.text}
                  </div>
                );
              }
              if (block.type === 'image') {
                return (
                  <img
                    key={idx}
                    src={block.source?.type === 'url' ? block.source.url : undefined}
                    alt="Image"
                    className="max-w-full rounded"
                  />
                );
              }
              return null;
            })
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {/* Metadata */}
        <div className="text-xs opacity-50 mt-2">
          {new Date(message.timestamp || message.createdAt).toLocaleTimeString('zh-CN')}
        </div>
      </div>
    </div>
  );
};
