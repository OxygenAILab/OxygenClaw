import React, { useRef, useEffect } from 'react';
import {
  Send, Paperclip, Image as ImageIcon, Mic, Square,
  Sliders, X, FileText
} from 'lucide-react';
import { Attachment } from '../../store';
import { formatBytes } from './utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading: boolean;
  mode: 'chat' | 'task' | 'computeruse';
  attachments: Attachment[];
  onAddAttachment: (file: File) => void;
  onRemoveAttachment: (id: string) => void;
  voiceEnabled?: boolean;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  showParams?: boolean;
  onToggleParams?: () => void;
  temperature?: number;
  onTemperatureChange?: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  mode,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  voiceEnabled = false,
  isRecording = false,
  onToggleRecording,
  showParams = false,
  onToggleParams,
  temperature = 0.7,
  onTemperatureChange,
  placeholder,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 自适应高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isLoading && (value.trim() || attachments.length > 0)) {
        onSend();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (type === 'image' && !file.type.startsWith('image/')) continue;
      onAddAttachment(file);
    }

    e.target.value = '';
  };

  const defaultPlaceholder = mode === 'chat'
    ? '输入消息，Enter 发送，Shift+Enter 换行...'
    : mode === 'task'
    ? '描述你的任务目标...'
    : '描述你想要在电脑上执行的操作...';

  return (
    <div className="w-full">
      {/* 参数面板 */}
      {showParams && (
        <div className="mb-3 p-4 bg-surface-variant rounded-2xl border border-outline-variant animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-on-surface flex items-center gap-2">
              <Sliders size={16} className="text-primary" />
              高级参数
            </span>
            <button
              onClick={onToggleParams}
              className="p-1 rounded-lg text-on-surface-variant hover:bg-surface transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-on-surface-variant">温度 (Temperature)</label>
                <span className="text-xs font-medium text-primary">{temperature.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={e => onTemperatureChange?.(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-on-surface-variant mt-1">
                <span>精确</span>
                <span>平衡</span>
                <span>创意</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 附件预览 */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map(att => (
            <div
              key={att.id}
              className="group relative flex items-center gap-2 px-3 py-2 bg-surface-variant rounded-xl border border-outline-variant"
            >
              {att.type === 'image' && att.dataUrl ? (
                <img src={att.dataUrl} alt={att.name} className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <FileText size={16} className="text-on-surface-variant" />
              )}
              <div className="max-w-[150px]">
                <div className="text-xs font-medium text-on-surface truncate">{att.name}</div>
                <div className="text-xs text-on-surface-variant">{formatBytes(att.size)}</div>
              </div>
              <button
                onClick={() => onRemoveAttachment(att.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-on-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入框主体 */}
      <div className={`relative bg-surface border border-outline-variant rounded-2xl shadow-sm focus-within:border-primary/50 focus-within:shadow-md focus-within:shadow-primary/5 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${isRecording ? 'ring-2 ring-error ring-opacity-30' : ''}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          rows={1}
          disabled={disabled}
          className="w-full px-4 py-3.5 bg-transparent resize-none outline-none text-sm text-on-surface placeholder-on-surface-variant max-h-[200px] disabled:cursor-not-allowed"
        />

        {/* 工具栏 */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={e => handleFileChange(e, 'file')}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isLoading}
              className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="上传文件"
            >
              <Paperclip size={18} />
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              multiple
              onChange={e => handleFileChange(e, 'image')}
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={disabled || isLoading}
              className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="上传图片"
            >
              <ImageIcon size={18} />
            </button>

            {voiceEnabled && (
              <button
                onClick={onToggleRecording}
                disabled={disabled || isLoading}
                className={`p-2 rounded-xl transition-colors ${
                  isRecording
                    ? 'bg-error text-on-error animate-pulse'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? '停止录音' : '语音输入'}
              >
                {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
              </button>
            )}

            <button
              onClick={onToggleParams}
              disabled={disabled || isLoading}
              className={`p-2 rounded-xl transition-colors ${
                showParams
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="参数设置"
            >
              <Sliders size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-4 py-2 bg-error text-on-error rounded-xl hover:opacity-90 transition-opacity text-sm font-medium"
              >
                <Square size={14} fill="currentColor" />
                停止
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={disabled || (!value.trim() && attachments.length === 0)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                发送
              </button>
            )}
          </div>
        </div>

        {/* 录音指示器 */}
        {isRecording && (
          <div className="absolute top-3 right-4 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"></span>
            </span>
            <span className="text-xs text-error font-medium">录音中...</span>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <p className="text-xs text-on-surface-variant text-center mt-2 opacity-70">
        OxygenClaw 可能会出错，请核实重要信息
      </p>
    </div>
  );
};

export default ChatInput;
