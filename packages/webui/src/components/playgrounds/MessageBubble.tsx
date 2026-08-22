import React, { useState, useRef, useEffect } from 'react';
import {
  Copy, ThumbsUp, ThumbsDown, RefreshCw, Edit3, Check, X,
  Bot, User, Volume2, VolumeX, ChevronDown, ChevronUp,
  Sparkles, Clock, FileText, Brain
} from 'lucide-react';
import { ChatMessage } from '../../store';
import { renderMarkdown, formatTimeAgo } from './utils';

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
  modelName?: string;
  onCopy: (content: string) => void;
  onRegenerate: () => void;
  onEdit: (content: string) => void;
  onFeedback: (type: 'like' | 'dislike') => void;
  onSpeak?: () => void;
  isSpeaking?: boolean;
  showAvatar?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isLast,
  isStreaming,
  modelName,
  onCopy,
  onRegenerate,
  onEdit,
  onFeedback,
  onSpeak,
  isSpeaking,
  showAvatar = true,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = editTextareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditStart = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent.trim() !== message.content) {
      onEdit(editContent.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleFeedback = (type: 'like' | 'dislike') => {
    const newFeedback = feedback === type ? null : type;
    setFeedback(newFeedback);
    if (newFeedback) {
      onFeedback(type);
    }
  };

  const hasReasoning = isAssistant && message.reasoningContent && message.reasoningContent.length > 0;
  const reasoningDuration = message.reasoningStartTime && message.reasoningEndTime
    ? ((message.reasoningEndTime - message.reasoningStartTime) / 1000).toFixed(1)
    : null;

  return (
    <div
      className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : ''} message-enter`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => !isEditing && setShowActions(false)}
    >
      {/* Avatar */}
      {showAvatar && (
        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
          isUser
            ? 'bg-secondary-container text-on-secondary-container'
            : 'bg-gradient-to-br from-primary to-tertiary text-on-primary'
        }`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] min-w-0`}>
        {/* Sender Info */}
        {isAssistant && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="text-sm font-semibold text-on-surface">{modelName || 'AI 助手'}</span>
            {hasReasoning && (
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-surface-variant text-on-surface-variant hover:bg-outline-variant/50 transition-colors"
              >
                <Sparkles size={12} className="text-tertiary" />
                <span>深度思考</span>
                {reasoningDuration && <span>· {reasoningDuration}s</span>}
                {showReasoning ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
        )}

        {/* Reasoning Block */}
        {hasReasoning && showReasoning && (
          <div className="w-full mb-2 px-1">
            <div className="p-3 rounded-xl bg-tertiary-container/30 border border-tertiary/20 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Brain size={14} className="text-tertiary flex-shrink-0" />
                <span className="font-medium text-on-surface text-xs uppercase tracking-wide">思考过程</span>
                {reasoningDuration && (
                  <span className="text-xs text-on-surface-variant ml-auto flex items-center gap-1">
                    <Clock size={12} />
                    {reasoningDuration}s
                  </span>
                )}
              </div>
              <div className="text-on-surface-variant whitespace-pre-wrap text-xs leading-relaxed pl-6">
                {message.reasoningContent}
              </div>
            </div>
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.attachments.map(att => (
              <div key={att.id} className="relative group/img">
                {att.type === 'image' && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="max-w-[240px] max-h-[240px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity border border-outline-variant"
                    onClick={() => att.dataUrl && window.open(att.dataUrl, '_blank')}
                  />
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-surface-variant rounded-lg text-sm">
                    <FileText size={16} className="text-on-surface-variant" />
                    <span className="text-on-surface">{att.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Generated Images */}
        {message.generatedImages && message.generatedImages.length > 0 && (
          <div className="w-full mb-2">
            <div className="grid grid-cols-2 gap-2">
              {message.generatedImages.map(img => (
                <div key={img.id} className="relative group/img rounded-xl overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="w-full rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={() => window.open(img.url, '_blank')}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Text Content / Edit Mode */}
        {isEditing ? (
          <div className={`w-full ${isUser ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'} rounded-2xl border border-outline-variant p-2`}>
            <textarea
              ref={editTextareaRef}
              value={editContent}
              onChange={e => {
                setEditContent(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              className={`w-full bg-transparent resize-none outline-none text-sm leading-relaxed ${
                isUser ? 'text-on-primary placeholder-on-primary/60' : 'text-on-surface placeholder-on-surface-variant'
              }`}
              rows={3}
            />
            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-outline-variant/50">
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                <X size={12} />
                取消
              </button>
              <button
                onClick={handleEditSubmit}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-primary text-on-primary hover:opacity-90 transition-opacity"
              >
                <Check size={12} />
                提交
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed message-bubble ${
              isUser
                ? 'bg-primary text-on-primary rounded-tr-md'
                : 'bg-surface text-on-surface rounded-tl-md border border-outline-variant'
            } ${isStreaming ? 'streaming-cursor' : ''}`}
          >
            {message.content ? (
              isAssistant ? (
                <div
                  className="message-content prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                />
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )
            ) : isStreaming ? (
              <div className="typing-indicator">
                <span className="typing-dot" />
                <span className="typing-dot delay-1" />
                <span className="typing-dot delay-2" />
              </div>
            ) : null}
          </div>
        )}

        {/* Timestamp + Actions */}
        <div className={`flex items-center gap-1 mt-1.5 px-1 h-5 ${
          isUser ? 'flex-row-reverse' : ''
        }`}>
          <span className="text-xs text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTimeAgo(message.timestamp)}
          </span>

          {/* Action Buttons - show on hover or for last message */}
          {isAssistant && !isEditing && (showActions || isLast) && (
            <div className={`flex items-center gap-0.5 ${isUser ? 'ml-1' : 'ml-1'}`}>
              <button
                onClick={handleCopy}
                className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                title={copied ? '已复制' : '复制'}
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>

              {isLast && !isStreaming && (
                <button
                  onClick={onRegenerate}
                  className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                  title="重新生成"
                >
                  <RefreshCw size={14} />
                </button>
              )}

              {isUser && isLast && (
                <button
                  onClick={handleEditStart}
                  className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                  title="编辑"
                >
                  <Edit3 size={14} />
                </button>
              )}

              <button
                onClick={() => handleFeedback('like')}
                className={`p-1 rounded-md transition-colors ${
                  feedback === 'like'
                    ? 'text-success bg-success-container/30'
                    : 'text-on-surface-variant hover:text-success hover:bg-surface-variant'
                }`}
                title="有用"
              >
                <ThumbsUp size={14} />
              </button>

              <button
                onClick={() => handleFeedback('dislike')}
                className={`p-1 rounded-md transition-colors ${
                  feedback === 'dislike'
                    ? 'text-error bg-error-container/30'
                    : 'text-on-surface-variant hover:text-error hover:bg-surface-variant'
                }`}
                title="没用"
              >
                <ThumbsDown size={14} />
              </button>

              {onSpeak && (
                <button
                  onClick={onSpeak}
                  className={`p-1 rounded-md transition-colors ${
                    isSpeaking
                      ? 'text-primary bg-primary-container/30'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-variant'
                  }`}
                  title={isSpeaking ? '停止' : '朗读'}
                >
                  {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
