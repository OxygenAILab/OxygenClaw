import { useState } from 'react';
import { ChevronLeft, ChevronRight, Code2, FileText, X } from 'lucide-react';
import TopBar from '../components/playgrounds/TopBar';
import ConversationSidebar from '../components/playgrounds/ConversationSidebar';
import WelcomePage from '../components/playgrounds/WelcomePage';
import ChatInput from '../components/playgrounds/ChatInput';
import MessageBubble from '../components/playgrounds/MessageBubble';
import { Button, Card } from '../components/ui';

/**
 * PlaygroundsV3 — 三栏布局重构
 * 
 * 架构：
 * - 左栏：会话侧栏（可折叠，固定 256px）
 * - 中栏：对话流（flex-1）
 * - 右栏：Canvas 画布（可折叠，固定 360px）
 */
export default function PlaygroundsV3() {
  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Canvas state
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState<{
    type: 'code' | 'markdown' | 'image';
    title: string;
    data: string;
  } | null>(null);

  // Mock data（后续接入真实数据）
  const [models] = useState([{ id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' }]);
  const [selectedModelId] = useState('gpt-4');
  const [capability] = useState<'fast' | 'think' | 'expert' | 'research' | 'moa'>('fast');
  const [mode] = useState<'chat' | 'task' | 'computeruse'>('chat');
  const [conversations] = useState<any[]>([]);
  const [activeConvId] = useState<string | null>(null);
  const [messages] = useState<any[]>([]);

  const hasMessages = messages.length > 0;

  // Mock canvas opener（后续由 MessageBubble 中的代码块触发）
  const openCanvas = (type: 'code' | 'markdown' | 'image', title: string, data: string) => {
    setCanvasContent({ type, title, data });
    setCanvasOpen(true);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* TopBar */}
      <TopBar
        models={models}
        selectedModelId={selectedModelId}
        onModelChange={() => {}}
        capability={capability}
        onCapabilityChange={() => {}}
        mode={mode}
        conversationTitle={activeConvId ? '当前对话' : undefined}
      />

      {/* 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左栏：会话侧栏 */}
        {!sidebarCollapsed && (
          <div className="w-64 border-r border-outline-variant bg-surface flex-shrink-0">
            <ConversationSidebar
              conversations={conversations}
              activeConvId={activeConvId}
              interactionMode={mode}
              onModeChange={() => {}}
              onNewConversation={() => {}}
              onSelectConversation={() => {}}
              onRename={() => {}}
              onDelete={() => {}}
              onSearch={() => {}}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          </div>
        )}

        {/* 中栏：对话流 */}
        <div className="flex-1 flex flex-col bg-surface min-w-0">
          {/* 折叠按钮（浮动在左上角） */}
          <div className="absolute top-16 left-2 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>

          {/* 对话区域 */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {!hasMessages ? (
              <WelcomePage
                mode={mode}
                suggestions={[]}
                onSelectSuggestion={(text: string) => console.log('Example:', text)}
              />
            ) : (
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    message={msg}
                    isLast={idx === messages.length - 1}
                    isStreaming={false}
                    onCopy={() => {}}
                    onRegenerate={() => {}}
                    onEdit={() => {}}
                    onFeedback={() => {}}
                    showAvatar={true}
                  />
                ))}
                {/* Mock: 演示 Canvas 打开按钮 */}
                <Card padding="md" className="max-w-sm">
                  <p className="text-sm text-on-surface-variant mb-3">
                    演示：点击按钮打开 Canvas 画布
                  </p>
                  <Button
                    variant="tonal"
                    size="sm"
                    leftIcon={<Code2 className="w-4 h-4" />}
                    onClick={() => openCanvas('code', 'example.js', 'function hello() {\n  console.log("Hello, World!");\n}')}
                  >
                    查看代码
                  </Button>
                </Card>
              </div>
            )}
          </div>

          {/* 输入框 */}
          <div className="border-t border-outline-variant px-4 py-4 bg-surface">
            <div className="max-w-4xl mx-auto">
              <ChatInput
                value=""
                onChange={() => {}}
                onSend={() => {}}
                onStop={() => {}}
                placeholder="输入消息..."
                disabled={false}
                isLoading={false}
                mode={mode}
                attachments={[]}
                onAddAttachment={() => {}}
                onRemoveAttachment={() => {}}
              />
            </div>
          </div>
        </div>

        {/* 右栏：Canvas 画布 */}
        {canvasOpen && (
          <div className="w-96 border-l border-outline-variant bg-surface-container flex-shrink-0 flex flex-col">
            {/* Canvas Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface">
              <div className="flex items-center gap-2 min-w-0">
                {canvasContent?.type === 'code' && <Code2 className="w-5 h-5 text-primary flex-shrink-0" />}
                {canvasContent?.type === 'markdown' && <FileText className="w-5 h-5 text-primary flex-shrink-0" />}
                <h3 className="font-semibold text-on-surface truncate">
                  {canvasContent?.title || 'Canvas'}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCanvasOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Canvas Content */}
            <div className="flex-1 overflow-auto p-4">
              {canvasContent?.type === 'code' && (
                <pre className="p-4 bg-surface-container-highest rounded-lg text-sm font-mono overflow-x-auto">
                  <code>{canvasContent.data}</code>
                </pre>
              )}
              {canvasContent?.type === 'markdown' && (
                <div className="prose prose-sm max-w-none">
                  {canvasContent.data}
                </div>
              )}
              {!canvasContent && (
                <div className="flex items-center justify-center h-full text-on-surface-variant">
                  暂无内容
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
