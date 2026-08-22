import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode, ChevronRight,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import ConversationSidebar from '../components/playgrounds/ConversationSidebar';
import TopBar from '../components/playgrounds/TopBar';
import MessageBubble from '../components/playgrounds/MessageBubble';
import WelcomePage from '../components/playgrounds/WelcomePage';
import ChatInput from '../components/playgrounds/ChatInput';
import { generateId } from '../components/playgrounds/utils';
import {
  llmApi,
  agentApi,
  settingsApi,
  conversationApi,
  ModelInfo,
  SuggestionPrompt,
} from '../services/api';
import {
  loadSettings,
  saveSettings,
  AppSettings as LocalAppSettings,
  loadProviders,
  getEnabledModels,
  Conversation,
  ChatMessage,
  Attachment,
} from '../store';

type InteractionMode = 'chat' | 'task' | 'computeruse';
type CapabilityMode = 'fast' | 'think' | 'expert' | 'research' | 'moa';

const CONV_KEY = 'oxygenclaw:conversations';
const SIDEBAR_KEY = 'oxygenclaw:playgrounds-sidebar-collapsed';

const PlaygroundsV2: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Models
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // UI State
  const [input, setInput] = useState('');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('chat');
  const [capability, setCapability] = useState<CapabilityMode>('fast');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });
  const [showParams, setShowParams] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Suggestions
  const [suggestions, setSuggestions] = useState<SuggestionPrompt[]>([]);

  // Settings
  const [appSettings, setAppSettings] = useState<LocalAppSettings>(loadSettings());

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Canvas
  const [canvasOpen, setCanvasOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ============== Initialization ==============
  useEffect(() => {
    const init = async () => {
      setConversations(loadConvs());
      await fetchModels();
      await fetchSettings();
      await fetchConversations();
      fetchSuggestions();
    };
    init();
  }, []);

  useEffect(() => { saveConvs(conversations); }, [conversations]);
  useEffect(() => { saveSettings(appSettings); }, [appSettings]);
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvId, conversations, isLoading]);

  // ============== Storage Helpers ==============
  const loadConvs = (): Conversation[] => {
    try {
      const raw = localStorage.getItem(CONV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const saveConvs = (convs: Conversation[]) => {
    localStorage.setItem(CONV_KEY, JSON.stringify(convs));
  };

  // ============== Data Fetching ==============
  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const result = await llmApi.getModels();
      if (result.success && result.data?.models && result.data.models.length > 0) {
        setModels(result.data.models);
      } else {
        const providers = loadProviders();
        const enabledModels = getEnabledModels(providers);
        setModels(enabledModels as unknown as ModelInfo[]);
      }
    } catch {
      const providers = loadProviders();
      const enabledModels = getEnabledModels(providers);
      setModels(enabledModels as unknown as ModelInfo[]);
    } finally {
      setModelsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const result = await settingsApi.get();
      if (result.success && result.data) {
        const s = result.data as any;
        setAppSettings(prev => ({
          ...prev,
          visionEnabled: !!s.vision_enabled,
          visionApiKey: s.vision_api_key || '',
          visionBaseUrl: s.vision_base_url || '',
          visionModel: s.vision_model || '',
          asrEnabled: !!s.asr_enabled,
          asrApiKey: s.asr_api_key || '',
          asrBaseUrl: s.asr_base_url || '',
          asrModel: s.asr_model || '',
          ttsEnabled: !!s.tts_enabled,
          ttsApiKey: s.tts_api_key || '',
          ttsBaseUrl: s.tts_base_url || '',
          ttsModel: s.tts_model || '',
          ttsVoice: s.tts_voice || '',
          voiceInputEnabled: !!s.voice_input_enabled,
          voiceOutputEnabled: !!s.voice_output_enabled,
          imageGenEnabled: !!s.image_gen_enabled,
          imageGenApiKey: s.image_gen_api_key || '',
          imageGenBaseUrl: s.image_gen_base_url || '',
          imageGenModel: s.image_gen_model || '',
          temperature: s.temperature ?? 0.7,
        }));
        if (s.temperature !== undefined) setTemperature(s.temperature);
      }
    } catch { /* use local settings */ }
  };

  const fetchSuggestions = async () => {
    try {
      const result = await conversationApi.getSuggestions(interactionMode);
      if (result.success && result.data?.suggestions) {
        setSuggestions(result.data.suggestions);
      }
    } catch {
      // Fallback
      const fallback: SuggestionPrompt[] = [
        { title: '写代码', prompt: '用 Python 写一个快速排序算法，并解释时间复杂度', category: '编程', icon: 'code' },
        { title: '翻译', prompt: '把下面这段文字翻译成英文：人工智能正在改变世界', category: '翻译', icon: 'globe' },
        { title: '写作', prompt: '写一篇关于"时间管理"的短文，300字左右', category: '写作', icon: 'pen' },
        { title: '学习', prompt: '用通俗易懂的方式解释什么是Transformer模型', category: '学习', icon: 'book' },
        { title: '创意', prompt: '给我5个周末可以做的有趣活动创意', category: '创意', icon: 'lightbulb' },
        { title: '分析', prompt: '分析一下远程工作的优缺点', category: '分析', icon: 'chart' },
        { title: '建议', prompt: '我想开始学习机器学习，能给我一个学习路线图吗？', category: '建议', icon: 'compass' },
        { title: '总结', prompt: '帮我总结一段文本的要点（粘贴内容后）', category: '总结', icon: 'list' },
      ];
      setSuggestions(fallback);
    }
  };

  const fetchConversations = async (mode = interactionMode) => {
    try {
      const result = await conversationApi.list(mode);
      if (result.success && result.data) {
        setConversations(prev => result.data!.map(conv => {
          const existing = prev.find(item => item.id === conv.id);
          return { ...conv, messages: existing?.messages || conv.messages || [] };
        }));
      }
    } catch {
      setConversations(loadConvs());
    }
  };

  const refreshConversation = async (id: string) => {
    const result = await conversationApi.get(id);
    if (result.success && result.data) {
      setConversations(prev => {
        const exists = prev.some(conv => conv.id === id);
        if (!exists) return [result.data!, ...prev];
        return prev.map(conv => conv.id === id ? result.data! : conv);
      });
      return result.data;
    }
    return null;
  };

  // ============== Conversation Actions ==============
  const activeConv = conversations.find(c => c.id === activeConvId);
  const selectedModel = models.find(m => m.id === activeConv?.modelId);

  const createNewConversation = async () => {
    const modelId = models[0]?.id || '';
    if (!modelId) {
      showToast({ type: 'error', title: '无法创建对话', description: '请先配置并启用模型' });
      return null;
    }

    try {
      const result = await conversationApi.create({
        title: '新对话',
        mode: interactionMode,
        capability,
        modelId,
      });
      if (!result.success || !result.data) throw new Error(result.error || '创建失败');

      setConversations(prev => [result.data!, ...prev.filter(conv => conv.id !== result.data!.id)]);
      setActiveConvId(result.data.id);
      setInput('');
      setAttachments([]);
      return result.data;
    } catch (e: any) {
      showToast({ type: 'error', title: '创建失败', description: e?.message || '无法创建后端对话' });
      return null;
    }
  };

  const selectConversation = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConvId(id);
      setInput('');
      setAttachments([]);
      setInteractionMode(conv.mode as InteractionMode);
      setCapability(conv.capability as CapabilityMode);
    }
    try {
      const latest = await refreshConversation(id);
      if (latest) {
        setInteractionMode(latest.mode as InteractionMode);
        setCapability(latest.capability as CapabilityMode);
      }
    } catch {
      showToast({ type: 'error', title: '加载失败', description: '无法加载对话详情' });
    }
  };

  const updateConv = (id: string, updates: Partial<Conversation>) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)
    );
  };

  const deleteConv = async (id: string) => {
    if (!confirm('确定要删除这个对话吗？')) return;
    try {
      const result = await conversationApi.remove(id);
      if (!result.success) throw new Error(result.error || '删除失败');
    } catch (e: any) {
      showToast({ type: 'error', title: '删除失败', description: e?.message || '无法删除后端对话' });
      return;
    }
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
  };

  const renameConv = async (id: string, title: string) => {
    updateConv(id, { title });
    try {
      const result = await conversationApi.update(id, { title });
      if (result.success && result.data) updateConv(id, result.data);
      if (!result.success) throw new Error(result.error || '重命名失败');
    } catch (e: any) {
      showToast({ type: 'error', title: '重命名失败', description: e?.message || '无法保存标题' });
      await refreshConversation(id).catch(() => undefined);
    }
  };

  const handleModeChange = (mode: InteractionMode) => {
    setInteractionMode(mode);
    setActiveConvId(null);
    setAttachments([]);
    fetchConversations(mode);
    fetchSuggestions();
  };

  const handleCapabilityChange = (cap: CapabilityMode) => {
    setCapability(cap);
    if (activeConvId) {
      updateConv(activeConvId, { capability: cap });
      conversationApi.update(activeConvId, { capability: cap }).catch(() => {
        showToast({ type: 'error', title: '保存失败', description: '无法保存能力模式' });
      });
    }
  };

  const handleModelChange = (modelId: string) => {
    if (activeConvId) {
      updateConv(activeConvId, { modelId });
      conversationApi.update(activeConvId, { modelId }).catch(() => {
        showToast({ type: 'error', title: '保存失败', description: '无法保存模型选择' });
      });
    }
  };

  // ============== Search ==============
  const handleSearch = useCallback((query: string) => setSearchQuery(query), []);

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : conversations;

  // ============== Attachments ==============
  const handleAddAttachment = async (file: File) => {
    const isImage = file.type.startsWith('image/');

    let dataUrl: string | undefined;
    if (isImage) {
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const att: Attachment = {
      id: generateId(),
      type: isImage ? 'image' : 'file',
      name: file.name,
      size: file.size,
      dataUrl,
    };
    setAttachments(prev => [...prev, att]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // ============== Send Message (Chat Mode) ==============
  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading) return;

    let convId = activeConvId;
    if (!convId) {
      const conv = await createNewConversation();
      if (!conv) return;
      convId = conv.id;
    }

    const currentConv = conversations.find(c => c.id === convId) ||
      { id: convId, modelId: models[0]?.id || '', messages: [] as ChatMessage[] };

    // User message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const newMessages = [...currentConv.messages, userMsg];
    updateConv(convId, { messages: newMessages });
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    // Assistant placeholder
    const assistantMsgId = generateId();
    const now = Date.now();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: now,
      reasoningStartTime: now,
    };
    updateConv(convId, { messages: [...newMessages, assistantMsg] });

    // Auto-title for first message
    if (newMessages.length === 1 && userMsg.content) {
      const title = userMsg.content.slice(0, 20) + (userMsg.content.length > 20 ? '...' : '');
      updateConv(convId, { title });
    }

    try {
      if (interactionMode === 'chat') {
        await sendChatMessage(convId, assistantMsgId, userMsg.content);
      } else if (interactionMode === 'task') {
        await conversationApi.saveMessage(convId, { role: 'user', content: userMsg.content, modelId: currentConv.modelId });
        await sendTaskMessage(convId, assistantMsgId, userMsg.content);
      } else {
        await conversationApi.saveMessage(convId, { role: 'user', content: userMsg.content, modelId: currentConv.modelId });
        await sendComputerUseMessage(convId, assistantMsgId, userMsg.content);
      }
    } catch (e: any) {
      updateConv(convId, {
        messages: [...newMessages, { ...assistantMsg, content: `错误: ${e?.message || '请求失败'}` }],
      });
      showToast({ type: 'error', title: '请求失败', description: e?.message || '未知错误' });
    } finally {
      setIsLoading(false);
    }
  };

  const sendChatMessage = async (convId: string, assistantMsgId: string, content: string) => {
    const currentConv = conversations.find(c => c.id === convId);
    const modelId = currentConv?.modelId || models[0]?.id;
    if (!modelId) throw new Error('未选择模型');

    const onMessage = (_chunk: string, data: any) => {
      const content = data?.choices?.[0]?.delta?.content || data?.content || '';
      const reasoningContent = data?.choices?.[0]?.delta?.reasoning_content || data?.reasoning_content || '';

      if (content || reasoningContent) {
        setConversations(prev => prev.map(c => {
          if (c.id !== convId) return c;
          return {
            ...c,
            updatedAt: Date.now(),
            messages: c.messages.map(m => {
              if (m.id !== assistantMsgId) return m;
              const updated: ChatMessage = { ...m };
              if (content) {
                updated.content = m.content + content;
                if (!m.reasoningEndTime && m.reasoningContent) {
                  updated.reasoningEndTime = Date.now();
                }
              }
              if (reasoningContent) {
                updated.reasoningContent = (m.reasoningContent || '') + reasoningContent;
              }
              return updated;
            }),
          };
        }));
      }
    };

    const onComplete = () => {
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantMsgId
              ? { ...m, reasoningEndTime: m.reasoningEndTime || Date.now() }
              : m
          ),
        };
      }));
      refreshConversation(convId).catch(() => undefined);
    };

    const onError = (error: string) => {
      throw new Error(error);
    };

    await conversationApi.sendMessage(convId, {
      content,
      modelId,
      onMessage: onMessage as any,
      onComplete,
      onError,
    });
  };

  const sendTaskMessage = async (convId: string, assistantMsgId: string, prompt: string) => {
    // Simplified task mode - uses agent API
    const modelId = conversations.find(c => c.id === convId)?.modelId || models[0]?.id;

    let fullContent = '';
    try {
      agentApi.execute(
        { prompt, mode: 'task', capability, modelId, onMessage: undefined },
        (_chunk: string, data: any) => {
          const content = data?.content || data?.result || data?.step?.content || '';
          if (content) {
            fullContent += content;
            setConversations(prev => prev.map(c => {
              if (c.id !== convId) return c;
              return {
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map(m =>
                  m.id === assistantMsgId ? { ...m, content: fullContent } : m
                ),
              };
            }));
          }
        },
        async () => {
          if (fullContent) {
            await conversationApi.saveMessage(convId, { role: 'assistant', content: fullContent, modelId }).catch(() => undefined);
            await refreshConversation(convId).catch(() => undefined);
          }
          setIsLoading(false);
        },
        (error) => { throw new Error(error); }
      );
    } catch (e: any) {
      throw e;
    }
  };

  const sendComputerUseMessage = async (convId: string, assistantMsgId: string, task: string) => {
    const modelId = conversations.find(c => c.id === convId)?.modelId || models[0]?.id;
    if (!modelId) throw new Error('未选择模型');

    let fullContent = '';
    try {
      agentApi.executeComputerUse(
        { task, modelId, onMessage: undefined },
        (_chunk: string, data: any) => {
          const content = data?.content || data?.result || '';
          if (content) {
            fullContent += content;
            setConversations(prev => prev.map(c => {
              if (c.id !== convId) return c;
              return {
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map(m =>
                  m.id === assistantMsgId ? { ...m, content: fullContent } : m
                ),
              };
            }));
          }
        },
        async () => {
          if (fullContent) {
            await conversationApi.saveMessage(convId, { role: 'assistant', content: fullContent }).catch(() => undefined);
            await refreshConversation(convId).catch(() => undefined);
          }
          setIsLoading(false);
        },
        (error) => { throw new Error(error); }
      );
    } catch (e: any) {
      throw e;
    }
  };

  // ============== Message Actions ==============
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    showToast({ type: 'success', title: '已复制', description: '消息已复制到剪贴板' });
  };

  const handleRegenerate = () => {
    if (!activeConvId || isLoading) return;

    const conv = conversations.find(c => c.id === activeConvId);
    if (!conv || conv.messages.length < 2) return;

    // Remove last assistant message
    const newMessages = [...conv.messages];
    while (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
      newMessages.pop();
    }

    if (newMessages.length === 0) return;

    updateConv(activeConvId, { messages: newMessages });
    setIsLoading(true);

    const assistantMsgId = generateId();
    const now = Date.now();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: now,
      reasoningStartTime: now,
    };
    updateConv(activeConvId, { messages: [...newMessages, assistantMsg] });

    if (interactionMode === 'chat') {
      streamRegenerate(activeConvId, assistantMsgId)
        .catch(e => {
          updateConv(activeConvId!, {
            messages: [...newMessages, { ...assistantMsg, content: `错误: ${e.message}` }],
          });
          showToast({ type: 'error', title: '重新生成失败', description: e.message });
        })
        .finally(() => setIsLoading(false));
    }
  };

  const streamRegenerate = async (convId: string, assistantMsgId: string) => {
    const onMessage = (data: any) => {
      const content = data?.choices?.[0]?.delta?.content || data?.content || '';
      if (!content) return;
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        return {
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: m.content + content } : m
          ),
        };
      }));
    };

    await conversationApi.regenerate(convId, {
      onMessage,
      onComplete: () => refreshConversation(convId).catch(() => undefined),
      onError: (error) => { throw new Error(error); },
    });
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!activeConvId || isLoading) return;

    const conv = conversations.find(c => c.id === activeConvId);
    if (!conv) return;

    const msgIndex = conv.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Keep messages up to and including the edited message
    const trimmedMessages = conv.messages.slice(0, msgIndex);
    const editedMsg: ChatMessage = { ...conv.messages[msgIndex], content: newContent };
    const newMessages = [...trimmedMessages, editedMsg];

    updateConv(activeConvId, { messages: newMessages });
    setIsLoading(true);

    const assistantMsgId = generateId();
    const now = Date.now();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: now,
      reasoningStartTime: now,
    };
    updateConv(activeConvId, { messages: [...newMessages, assistantMsg] });

    if (interactionMode === 'chat') {
      streamEditMessage(activeConvId, messageId, newContent, assistantMsgId)
        .catch(e => {
          updateConv(activeConvId!, {
            messages: [...newMessages, { ...assistantMsg, content: `错误: ${e.message}` }],
          });
          showToast({ type: 'error', title: '重新生成失败', description: e.message });
        })
        .finally(() => setIsLoading(false));
    }
  };

  const streamEditMessage = async (convId: string, messageId: string, content: string, assistantMsgId: string) => {
    const onMessage = (data: any) => {
      const chunk = data?.choices?.[0]?.delta?.content || data?.content || '';
      if (!chunk) return;
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        return {
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m
          ),
        };
      }));
    };

    await conversationApi.editMessage(convId, messageId, {
      content,
      onMessage,
      onComplete: () => refreshConversation(convId).catch(() => undefined),
      onError: (error) => { throw new Error(error); },
    });
  };

  const handleFeedback = (messageId: string, type: 'like' | 'dislike') => {
    if (!activeConvId) return;
    conversationApi.sendFeedback(activeConvId, messageId, type)
      .catch(() => { /* silently ignore */ });
    showToast({
      type: type === 'like' ? 'success' : 'info',
      title: type === 'like' ? '感谢反馈' : '感谢反馈',
      description: type === 'like' ? '很高兴对您有帮助' : '我们会继续改进',
    });
  };

  const handleStop = () => {
    // Stop generation - simply mark as not loading
    setIsLoading(false);
    showToast({ type: 'info', title: '已停止', description: '生成已停止' });
  };

  const handleSelectSuggestion = (prompt: string) => {
    setInput(prompt);
  };

  // ============== Render ==============
  const showWelcome = !activeConv || activeConv.messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
        <ConversationSidebar
          conversations={filteredConversations}
          activeConvId={activeConvId}
          interactionMode={interactionMode}
          onModeChange={handleModeChange}
          onNewConversation={createNewConversation}
          onSelectConversation={selectConversation}
          onRename={renameConv}
          onDelete={deleteConv}
          onSearch={handleSearch}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
          <TopBar
            models={models}
            selectedModelId={activeConv?.modelId || ''}
            onModelChange={handleModelChange}
            capability={capability}
            onCapabilityChange={handleCapabilityChange}
            mode={interactionMode}
            modelsLoading={modelsLoading}
            onRefreshModels={fetchModels}
            onOpenModelSettings={() => navigate('/models')}
            conversationTitle={showWelcome ? undefined : activeConv?.title}
          />

        {/* Messages / Welcome */}
        <div className="flex-1 overflow-y-auto">
          {showWelcome ? (
            <WelcomePage
              mode={interactionMode}
              suggestions={suggestions}
              onSelectSuggestion={handleSelectSuggestion}
              modelName={selectedModel?.name}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {activeConv!.messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isLast={idx === activeConv!.messages.length - 1}
                  isStreaming={isLoading && idx === activeConv!.messages.length - 1 && msg.role === 'assistant'}
                  modelName={selectedModel?.name}
                  onCopy={handleCopyMessage}
                  onRegenerate={handleRegenerate}
                  onEdit={(content) => handleEditMessage(msg.id, content)}
                  onFeedback={(type) => handleFeedback(msg.id, type)}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-outline-variant bg-surface/80 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onStop={handleStop}
              isLoading={isLoading}
              mode={interactionMode}
              attachments={attachments}
              onAddAttachment={handleAddAttachment}
              onRemoveAttachment={handleRemoveAttachment}
              voiceEnabled={appSettings.asrEnabled}
              showParams={showParams}
              onToggleParams={() => setShowParams(!showParams)}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              disabled={models.length === 0 && !modelsLoading}
            />
          </div>
        </div>
      </div>

      {/* Canvas Sidebar Toggle */}
      <div className={`flex flex-col items-center py-3 border-l border-outline-variant bg-surface w-10 ${
        canvasOpen ? '' : ''
      }`}>
        <button
          onClick={() => setCanvasOpen(!canvasOpen)}
          className="w-8 h-8 rounded-xl text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors"
          title={canvasOpen ? '收起 Canvas' : '展开 Canvas'}
        >
          <FileCode size={16} />
        </button>
        {canvasOpen && (
          <div className="absolute right-10 top-14 bottom-14 w-80 bg-surface border border-outline-variant rounded-l-xl shadow-xl z-10 animate-slide-in-right">
            <div className="p-3 border-b border-outline-variant flex items-center justify-between">
              <span className="font-medium text-on-surface text-sm flex items-center gap-2">
                <FileCode size={14} className="text-primary" />
                Canvas
              </span>
              <button
                onClick={() => setCanvasOpen(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-variant"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="p-4 text-center text-sm text-on-surface-variant">
              <p>Canvas 功能开发中</p>
              <p className="text-xs mt-1">用于编辑和预览代码文件</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaygroundsV2;
