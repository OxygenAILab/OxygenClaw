import React from 'react';
import {
  Sparkles, Code, Globe, PenTool, BookOpen,
  Lightbulb, BarChart3, Compass, List, FileText,
  Bot, Zap, Brain, Microscope, LucideIcon
} from 'lucide-react';
import { SuggestionPrompt } from '../../services/api';

interface WelcomePageProps {
  mode: 'chat' | 'task' | 'computeruse';
  suggestions: SuggestionPrompt[];
  onSelectSuggestion: (prompt: string) => void;
  modelsCount: number;
  modelName?: string;
}

const iconMap: Record<string, LucideIcon> = {
  code: Code,
  globe: Globe,
  pen: PenTool,
  book: BookOpen,
  lightbulb: Lightbulb,
  chart: BarChart3,
  compass: Compass,
  list: List,
  file: FileText,
  microscope: Microscope,
};

const WelcomePage: React.FC<WelcomePageProps> = ({
  mode,
  suggestions,
  onSelectSuggestion,
  modelsCount: _modelsCount,
  modelName,
}) => {
  const modeInfo = {
    chat: {
      title: '有什么可以帮你的？',
      subtitle: '选择一个建议开始对话，或直接输入你的问题',
      icon: Sparkles,
    },
    task: {
      title: '创建一个任务',
      subtitle: '描述你的目标，AI 会自动规划并完成任务',
      icon: Zap,
    },
    computeruse: {
      title: '电脑操作助手',
      subtitle: '描述你想要在电脑上执行的操作，AI 会自动操控鼠标和键盘',
      icon: Bot,
    },
  };

  const info = modeInfo[mode];
  const Icon = info.icon;

  // 按分类分组
  const categories = [...new Set(suggestions.map(s => s.category))];

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
      <div className="max-w-3xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-primary to-tertiary flex items-center justify-center shadow-lg shadow-primary/20">
            <Icon size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2 tracking-tight">
            {info.title}
          </h1>
          <p className="text-on-surface-variant text-base">
            {info.subtitle}
          </p>
          {modelName && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-surface-variant rounded-full text-xs text-on-surface-variant">
              <Bot size={12} />
              <span>当前模型: {modelName}</span>
            </div>
          )}
        </div>

        {/* Suggestion Cards */}
        {suggestions.length > 0 && (
          <div className="space-y-5">
            {categories.slice(0, 2).map(category => (
              <div key={category}>
                <h3 className="text-sm font-medium text-on-surface-variant mb-3 px-1 flex items-center gap-2">
                  {(() => {
                    const CatIcon = iconMap[
                      suggestions.find(s => s.category === category)?.icon || 'list'
                    ] || List;
                    return <CatIcon size={14} />;
                  })()}
                  {category}
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {suggestions
                    .filter(s => s.category === category)
                    .slice(0, 4)
                    .map((suggestion, idx) => {
                      const SuggIcon = iconMap[suggestion.icon || 'list'] || Sparkles;
                      return (
                        <button
                          key={idx}
                          onClick={() => onSelectSuggestion(suggestion.prompt)}
                          className="group p-4 text-left bg-surface border border-outline-variant rounded-2xl hover:border-primary/30 hover:bg-surface-variant/50 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-primary-container/50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-container transition-colors">
                              <SuggIcon size={16} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-on-surface text-sm mb-0.5 truncate">
                                {suggestion.title}
                              </div>
                              <div className="text-xs text-on-surface-variant line-clamp-2 leading-snug">
                                {suggestion.prompt}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Capabilities Info */}
        {mode === 'chat' && (
          <div className="mt-10 pt-8 border-t border-outline-variant">
            <h3 className="text-sm font-medium text-on-surface-variant text-center mb-4">支持的能力</h3>
            <div className="flex justify-center gap-3 flex-wrap">
              {[
                { icon: Code, label: '代码生成' },
                { icon: Globe, label: '多语言翻译' },
                { icon: Brain, label: '深度思考' },
                { icon: BookOpen, label: '知识问答' },
                { icon: PenTool, label: '创意写作' },
                { icon: Lightbulb, label: '创意激发' },
              ].map((cap, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-variant/50 rounded-full"
                >
                  <cap.icon size={14} style={{ color: 'var(--md-on-surface-variant)' }} />
                  <span className="text-xs text-on-surface-variant">{cap.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomePage;
