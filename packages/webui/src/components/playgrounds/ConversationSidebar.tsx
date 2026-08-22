import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Search, MoreHorizontal, Edit2, Trash2,
  MessageSquare, ListTodo, Monitor, ChevronLeft, ChevronRight,
  Sparkles, Clock
} from 'lucide-react';
import { Conversation } from '../../store';
import { capabilityModes } from './utils';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConvId: string | null;
  interactionMode: 'chat' | 'task' | 'computeruse';
  onModeChange: (mode: 'chat' | 'task' | 'computeruse') => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSearch: (query: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConvId,
  interactionMode,
  onModeChange,
  onNewConversation,
  onSelectConversation,
  onRename,
  onDelete,
  onSearch,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      onSearch(searchQuery);
    }, 200);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, onSearch]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const menuEl = menuRefs.current.get(menuOpen);
      const triggerBtn = (e.target as HTMLElement).closest('button');
      if (menuEl && !menuEl.contains(e.target as Node) &&
          (!triggerBtn || !triggerBtn.closest('[data-menu-trigger]'))) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
    setMenuOpen(null);
  };

  const saveRename = () => {
    if (editingId && editingTitle.trim()) {
      onRename(editingId, editingTitle.trim());
    }
    setEditingId(null);
  };

  const modeConfig = [
    { id: 'chat' as const, label: '对话', icon: MessageSquare },
    { id: 'task' as const, label: '任务', icon: ListTodo },
    { id: 'computeruse' as const, label: '电脑', icon: Monitor },
  ];

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'chat': return MessageSquare;
      case 'task': return ListTodo;
      case 'computeruse': return Monitor;
      default: return MessageSquare;
    }
  };

  const filteredConvs = conversations.filter(c => c.mode === interactionMode);

  if (isCollapsed) {
    return (
      <div className="w-14 bg-surface border-r border-outline-variant flex flex-col items-center py-3 gap-2">
        <button
          onClick={onNewConversation}
          className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:opacity-90 transition-opacity"
          title="新建对话"
        >
          <Plus size={20} />
        </button>
        <div className="w-8 h-px bg-outline-variant my-1" />
        {modeConfig.map(mode => {
          const Icon = mode.icon;
          const active = interactionMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                active
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
              title={mode.label}
            >
              <Icon size={20} />
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 rounded-xl text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors"
          title="展开侧边栏"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-surface border-r border-outline-variant flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-outline-variant flex items-center gap-2">
        <button
          onClick={onNewConversation}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          新建{interactionMode === 'chat' ? '对话' : interactionMode === 'task' ? '任务' : '电脑操作'}
        </button>
        <button
          onClick={onToggleCollapse}
          className="w-9 h-9 rounded-xl text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors"
          title="收起侧边栏"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Mode Switch */}
      <div className="px-3 pt-3">
        <div className="flex bg-surface-variant rounded-xl p-1">
          {modeConfig.map(mode => {
            const Icon = mode.icon;
            const active = interactionMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-surface text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon size={14} />
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-9 pr-3 py-2 bg-surface-variant rounded-xl text-sm text-on-surface placeholder-on-surface-variant border-none outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {filteredConvs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-surface-variant flex items-center justify-center">
              <Sparkles size={22} className="text-on-surface-variant opacity-60" />
            </div>
            <div className="text-sm text-on-surface-variant font-medium mb-1">
              暂无{interactionMode === 'chat' ? '对话' : interactionMode === 'task' ? '任务' : '电脑操作'}
            </div>
            <div className="text-xs text-on-surface-variant opacity-70">
              点击上方按钮开始新的对话
            </div>
          </div>
        ) : (
          filteredConvs.map(conv => {
            const ModeIcon = getModeIcon(conv.mode);
            const capInfo = capabilityModes.find(m => m.id === conv.capability);
            return (
              <div
                key={conv.id}
                className={`group relative rounded-xl cursor-pointer transition-all ${
                  activeConvId === conv.id
                    ? 'bg-primary-container text-on-primary-container'
                    : 'hover:bg-surface-variant/70 text-on-surface'
                }`}
                onClick={() => onSelectConversation(conv.id)}
              >
                {editingId === conv.id ? (
                  <div className="p-2.5">
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={saveRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface focus:border-primary focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="p-2.5 pr-8">
                    <div className="flex items-center gap-2 mb-1">
                      <ModeIcon size={14} className={activeConvId === conv.id ? 'text-on-primary-container/70' : 'text-on-surface-variant'} />
                      <span className="text-sm font-medium truncate flex-1">{conv.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs opacity-70 pl-6">
                      {capInfo && (
                        <span className="flex items-center gap-1">
                          <capInfo.icon size={10} style={{ color: capInfo.color }} />
                          {capInfo.label}
                        </span>
                      )}
                      <span>·</span>
                      <span>{formatTime(conv.updatedAt)}</span>
                    </div>
                  </div>
                )}
                <button
                  data-menu-trigger
                  onClick={e => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === conv.id ? null : conv.id);
                  }}
                  style={{ transform: 'translateY(-50%)' }}
                  className={`absolute right-1.5 top-1/2 p-1.5 rounded-lg transition-colors ${
                    activeConvId === conv.id
                      ? 'opacity-100 bg-black/10 hover:bg-black/20'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-surface-variant'
                  }`}
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen === conv.id && (
                  <div
                    ref={el => { if (el) menuRefs.current.set(conv.id, el); }}
                    className="absolute right-2 top-full mt-1 w-36 bg-surface rounded-xl border border-outline-variant shadow-xl py-1.5 z-20 animate-slide-down"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => startRename(conv)}
                      className="w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-variant flex items-center gap-2.5 transition-colors"
                    >
                      <Edit2 size={14} /> 重命名
                    </button>
                    <button
                      onClick={() => { onDelete(conv.id); setMenuOpen(null); }}
                      className="w-full px-3 py-2 text-left text-sm text-error hover:bg-error-container/30 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 size={14} /> 删除
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer - 今日/更早分组 */}
      <div className="px-3 py-2 border-t border-outline-variant">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant opacity-70">
          <Clock size={12} />
          <span>共 {filteredConvs.length} 个{interactionMode === 'chat' ? '对话' : '任务'}</span>
        </div>
      </div>
    </div>
  );
};

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const day = 24 * 60 * 60 * 1000;

  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default ConversationSidebar;
