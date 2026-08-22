import React, { useState, useRef, useEffect } from 'react';
import { Bot, ChevronDown, Eye, Paperclip, Palette, RefreshCw, Settings } from 'lucide-react';
import { ModelInfo } from '../../services/api';
import { capabilityModes } from './utils';

interface TopBarProps {
  models: ModelInfo[];
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  capability: 'fast' | 'think' | 'expert' | 'research' | 'moa';
  onCapabilityChange: (capability: 'fast' | 'think' | 'expert' | 'research' | 'moa') => void;
  mode: 'chat' | 'task' | 'computeruse';
  modelsLoading?: boolean;
  onRefreshModels?: () => void;
  onOpenModelSettings?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  conversationTitle?: string;
}

const TopBar: React.FC<TopBarProps> = ({
  models,
  selectedModelId,
  onModelChange,
  capability,
  onCapabilityChange,
  mode,
  modelsLoading = false,
  onRefreshModels,
  onOpenModelSettings,
  isFullscreen: _isFullscreen = false,
  onToggleFullscreen: _onToggleFullscreen,
  conversationTitle,
}) => {
  const [modelOpen, setModelOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find(m => m.id === selectedModelId);

  useEffect(() => {
    if (!modelOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelOpen]);

  return (
    <div className="h-14 border-b border-outline-variant flex items-center justify-between px-4 bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
      {/* Left - Capability Mode + Conversation Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {conversationTitle && (
          <h2 className="text-sm font-semibold text-on-surface truncate max-w-[200px]">
            {conversationTitle}
          </h2>
        )}

        {mode !== 'computeruse' && (
          <div className="flex items-center gap-1 bg-surface-variant/70 rounded-full p-0.5">
            {capabilityModes.map(modeInfo => {
              const Icon = modeInfo.icon;
              const active = capability === modeInfo.id;
              return (
                <button
                  key={modeInfo.id}
                  onClick={() => onCapabilityChange(modeInfo.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    active
                      ? 'bg-surface text-on-surface shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
                  }`}
                  title={modeInfo.desc}
                >
                  <Icon size={12} style={{ color: active ? modeInfo.color : undefined }} />
                  <span className="hidden sm:inline">{modeInfo.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right - Model Selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setModelOpen(v => !v)}
          disabled={models.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-variant/70 hover:bg-surface-variant rounded-full text-sm text-on-surface transition-colors disabled:opacity-50 group"
        >
          <Bot size={14} className="text-primary" />
          <span className="max-w-[160px] truncate font-medium">
            {selectedModel?.name || (modelsLoading ? '加载中...' : (models.length === 0 ? '选择模型' : '选择模型'))}
          </span>
          <ChevronDown size={14} className={`text-on-surface-variant transition-transform ${modelOpen ? 'rotate-180' : ''}`} />
        </button>

        {modelOpen && models.length > 0 && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-surface rounded-2xl border border-outline-variant shadow-xl overflow-hidden z-20 animate-slide-down">
            <div className="p-2 border-b border-outline-variant flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface-variant px-2">
                可用模型 ({models.length})
              </span>
              <div className="flex items-center gap-1">
                {onRefreshModels && (
                  <button
                    onClick={onRefreshModels}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                    title="刷新"
                  >
                    <RefreshCw size={14} className={modelsLoading ? 'animate-spin' : ''} />
                  </button>
                )}
                {onOpenModelSettings && (
                  <button
                    onClick={onOpenModelSettings}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                    title="模型设置"
                  >
                    <Settings size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="p-1.5 max-h-80 overflow-y-auto">
              {models.map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id);
                    setModelOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                    selectedModel?.id === model.id
                      ? 'bg-primary-container text-on-primary-container'
                      : 'hover:bg-surface-variant text-on-surface'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selectedModel?.id === model.id ? 'bg-primary/20' : 'bg-surface-variant'
                  }`}>
                    <Bot size={16} className={selectedModel?.id === model.id ? 'text-on-primary-container' : 'text-primary'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{model.name || model.id}</div>
                    {model.contextWindow && (
                      <div className={`text-xs opacity-70 ${selectedModel?.id === model.id ? 'text-on-primary-container/70' : 'text-on-surface-variant'}`}>
                        {(model.contextWindow / 1000).toFixed(0)}K 上下文
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {model.supportsVision && (
                      <Eye size={12} className={selectedModel?.id === model.id ? 'text-on-primary-container/70' : 'text-on-surface-variant'} />
                    )}
                    {model.supportsFiles && (
                      <Paperclip size={12} className={selectedModel?.id === model.id ? 'text-on-primary-container/70' : 'text-on-surface-variant'} />
                    )}
                    {model.supportsImageGeneration && (
                      <Palette size={12} className="text-tertiary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            {onOpenModelSettings && (
              <div className="p-2 border-t border-outline-variant">
                <button
                  onClick={onOpenModelSettings}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-primary font-medium hover:bg-primary-container/30 rounded-xl transition-colors"
                >
                  <Settings size={12} />
                  管理模型
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;
