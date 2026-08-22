import React, { useState } from 'react';
import { useConversations, useDeleteConversation } from '../hooks/useConversations';
import type { Conversation } from '../../../api/types';

interface ConversationListProps {
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  selectedId,
  onSelect,
  onNewChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { data, isLoading, error } = useConversations({
    search: searchQuery || undefined,
    archived: showArchived,
    pageSize: 50,
  });

  const deleteMutation = useDeleteConversation();

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定删除此会话？')) {
      deleteMutation.mutate(id);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        加载会话失败: {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FBF9F5] border-r border-[#E7E1D7]">
      {/* Header */}
      <div className="p-4 border-b border-[#E7E1D7]">
        <button
          onClick={onNewChat}
          className="w-full px-4 py-2 bg-[#C4612F] text-white rounded-full hover:bg-[#A94E22] transition-colors"
        >
          新建会话
        </button>
      </div>

      {/* Search */}
      <div className="p-4">
        <input
          type="text"
          placeholder="搜索会话..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-[#E7E1D7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4612F]"
        />
      </div>

      {/* Filter */}
      <div className="px-4 pb-2">
        <label className="flex items-center text-sm text-[#5C635D]">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="mr-2"
          />
          显示已归档
        </label>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[#5C635D]">
            加载中...
          </div>
        ) : data?.conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[#5C635D]">
            暂无会话
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {data?.conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelect(conversation)}
                className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedId === conversation.id
                    ? 'bg-white border border-[#C4612F]'
                    : 'hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-[#1F2421] truncate">
                      {conversation.title || '新会话'}
                    </h3>
                    <p className="text-xs text-[#5C635D] mt-1">
                      {new Date(conversation.updatedAt).toLocaleDateString('zh-CN')}
                    </p>
                    {conversation.mode && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-[#F2E3D6] text-[#C4612F] rounded-full">
                        {conversation.mode}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, conversation.id)}
                    className="opacity-0 group-hover:opacity-100 ml-2 text-[#5C635D] hover:text-red-500 transition-opacity"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
