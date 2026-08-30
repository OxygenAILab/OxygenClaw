import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Send, Paperclip, Image as ImageUploadIcon, Bot, User, ChevronDown,
  Sparkles, Brain, Microscope, Users, Zap, MoreHorizontal,
  Edit2, Trash2, AlertCircle, Loader2, Mic, Volume2, VolumeX, Square,
  X, Play, FileText, Code, Eye, FileCode, ChevronLeft, ChevronRight,
  Download, RefreshCw, Palette, Settings, Server, Monitor, MousePointer,
  Keyboard, Scroll, CheckCircle, XCircle, Clock, StopCircle,
  Maximize2, Minimize2, Copy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { llmApi, agentApi, multimodalApi, settingsApi, conversationApi, ModelInfo, ChatMessage as ApiChatMessage, directLlmApi, AgentTask } from '../services/api';
import { useToast } from '../components/Toast';
import { loadSettings, saveSettings, AppSettings as LocalAppSettings, loadProviders, getEnabledModels } from '../store';

type InteractionMode = 'chat' | 'task' | 'computeruse';
type CapabilityMode = 'fast' | 'think' | 'expert' | 'research' | 'moa';

interface AgentStep {
  id: string;
  type: 'think' | 'tool' | 'tool_call' | 'tool_result' | 'action' | 'result' | 'final' | 'error' | 'screenshot' | 'plan' | 'observe';
  title?: string;
  content?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: number;
  screenshot?: string;
  actionType?: 'click' | 'type' | 'scroll' | 'keypress' | 'navigate' | 'other';
  toolName?: string;
  toolParams?: any;
  toolResult?: any;
  toolDescription?: string;
  executionTime?: number;
  actionParams?: any;
}

const capabilityModes: {
  id: CapabilityMode; label: string; icon: typeof Zap;
  color: string; desc: string;
}[] = [
  { id: 'fast', label: '快速', icon: Zap, color: '#34c759', desc: '极速响应，少量搜索' },
  { id: 'think', label: '思考', icon: Brain, color: '#0071e3', desc: '深度思考，多轮联网' },
  { id: 'expert', label: '专家', icon: Sparkles, color: '#af52de', desc: 'CoT 链式思考，更多联网' },
  { id: 'research', label: '研究', icon: Microscope, color: '#ff9500', desc: '交叉验证，无限搜索，交付文档' },
  { id: 'moa', label: '协作', icon: Users, color: '#ff3b30', desc: '多 Agent 协作，投票产出' },
];

interface Conversation {
  id: string;
  title: string;
  mode: 'chat' | 'task' | 'computeruse';
  capability: CapabilityMode;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  agentSteps?: AgentStep[];
  computerUseSteps?: AgentStep[];
  taskId?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  generatedImages?: GeneratedImage[];
  isLoading?: boolean;
  reasoningContent?: string;
  reasoningStartTime?: number;
  reasoningEndTime?: number;
}

interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  dataUrl?: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  size: string;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  timestamp: number;
}

interface ImageGenerationParams {
  size: string;
  steps: number;
  cfgScale: number;
  quality: string;
  negativePrompt: string;
}

const IMAGE_SIZES = [
  '1024x1024',
  '512x512',
  '768x768',
  '1024x768',
  '768x1024',
  '1280x720',
  '720x1280',
  '1536x1024',
  '1024x1536',
];

type FileType = 'text' | 'markdown' | 'code' | 'json' | 'html' | 'css';

interface CanvasFile {
  id: string;
  name: string;
  type: FileType;
  content: string;
  language: string;
  createdAt: number;
  updatedAt: number;
}

interface CanvasState {
  isOpen: boolean;
  activeFileId: string | null;
  files: CanvasFile[];
  viewMode: 'edit' | 'preview';
  output: string;
  isRunning: boolean;
}

const CANVAS_KEY = 'oxygenclaw:canvas';
const CONV_KEY = 'oxygenclaw:conversations';

const SUPPORTED_EXTENSIONS: Record<string, { type: FileType; language: string }> = {
  '.txt': { type: 'text', language: 'text' },
  '.md': { type: 'markdown', language: 'markdown' },
  '.markdown': { type: 'markdown', language: 'markdown' },
  '.json': { type: 'json', language: 'json' },
  '.js': { type: 'code', language: 'javascript' },
  '.jsx': { type: 'code', language: 'javascript' },
  '.ts': { type: 'code', language: 'typescript' },
  '.tsx': { type: 'code', language: 'typescript' },
  '.py': { type: 'code', language: 'python' },
  '.html': { type: 'html', language: 'html' },
  '.htm': { type: 'html', language: 'html' },
  '.css': { type: 'css', language: 'css' },
  '.java': { type: 'code', language: 'java' },
  '.c': { type: 'code', language: 'c' },
  '.cpp': { type: 'code', language: 'cpp' },
  '.go': { type: 'code', language: 'go' },
  '.rs': { type: 'code', language: 'rust' },
  '.rb': { type: 'code', language: 'ruby' },
  '.php': { type: 'code', language: 'php' },
  '.sh': { type: 'code', language: 'shell' },
  '.bash': { type: 'code', language: 'shell' },
  '.yaml': { type: 'code', language: 'yaml' },
  '.yml': { type: 'code', language: 'yaml' },
  '.xml': { type: 'code', language: 'xml' },
  '.sql': { type: 'code', language: 'sql' },
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]): void {
  localStorage.setItem(CONV_KEY, JSON.stringify(convs));
}

function getFileInfo(filename: string): { type: FileType; language: string } {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS[ext] || { type: 'text', language: 'text' };
}

function isSupportedFile(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return !!SUPPORTED_EXTENSIONS[ext];
}

function loadCanvasState(): CanvasState {
  try {
    const raw = localStorage.getItem(CANVAS_KEY);
    if (!raw) {
      return {
        isOpen: false,
        activeFileId: null,
        files: [],
        viewMode: 'edit',
        output: '',
        isRunning: false,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      isOpen: false,
      activeFileId: parsed.activeFileId || null,
      files: parsed.files || [],
      viewMode: parsed.viewMode || 'edit',
      output: '',
      isRunning: false,
    };
  } catch {
    return {
      isOpen: false,
      activeFileId: null,
      files: [],
      viewMode: 'edit',
      output: '',
      isRunning: false,
    };
  }
}

function saveCanvasState(state: CanvasState): void {
  const toSave = {
    activeFileId: state.activeFileId,
    files: state.files,
    viewMode: state.viewMode,
  };
  localStorage.setItem(CANVAS_KEY, JSON.stringify(toSave));
}

function simpleHighlight(code: string, language: string): string {
  const escaped = escapeHtml(code);
  let result = escaped;

  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'new', 'this', 'super', 'import', 'export', 'default', 'from', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'true', 'false', 'null', 'undefined', 'NaN', 'Infinity'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'new', 'this', 'super', 'import', 'export', 'default', 'from', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'true', 'false', 'null', 'undefined', 'interface', 'type', 'enum', 'implements', 'extends', 'private', 'public', 'protected', 'readonly', 'static', 'abstract'],
    python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'pass', 'lambda', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'self', 'super', 'async', 'await', 'yield', 'global', 'nonlocal'],
    java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'String', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'super', 'import', 'package', 'try', 'catch', 'finally', 'throw', 'throws', 'null', 'true', 'false'],
    go: ['func', 'var', 'const', 'type', 'struct', 'interface', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'package', 'import', 'go', 'defer', 'chan', 'select', 'go', 'map', 'make', 'new', 'nil', 'true', 'false', 'iota'],
    rust: ['fn', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'pub', 'priv', 'use', 'mod', 'crate', 'super', 'self', 'return', 'if', 'else', 'match', 'for', 'in', 'while', 'loop', 'break', 'continue', 'move', 'ref', 'as', 'dyn', 'where', 'static', 'unsafe', 'async', 'await', 'true', 'false', 'Some', 'None', 'Ok', 'Err'],
    ruby: ['def', 'class', 'module', 'return', 'if', 'elsif', 'else', 'unless', 'for', 'while', 'until', 'break', 'next', 'redo', 'retry', 'begin', 'rescue', 'ensure', 'raise', 'yield', 'lambda', 'proc', 'true', 'false', 'nil', 'and', 'or', 'not', 'self', 'super', 'include', 'extend', 'require', 'end'],
    php: ['function', 'class', 'interface', 'trait', 'extends', 'implements', 'public', 'private', 'protected', 'static', 'const', 'return', 'if', 'else', 'elseif', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'self', 'parent', 'use', 'namespace', 'try', 'catch', 'finally', 'throw', 'true', 'false', 'null', 'echo', 'print', 'isset', 'empty', 'count', 'array'],
    shell: ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac', 'function', 'return', 'exit', 'break', 'continue', 'echo', 'printf', 'read', 'export', 'local', 'global', 'declare', 'readonly', 'source', 'eval', 'exec', 'true', 'false', 'null'],
    yaml: [],
    xml: [],
    sql: ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'AS', 'DISTINCT', 'TOP', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DATABASE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CHECK', 'INDEX', 'VIEW', 'UNION', 'ALL'],
  };

  const builtins: Record<string, string[]> = {
    javascript: ['console', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Error', 'Promise', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'document', 'window', 'navigator'],
    typescript: ['console', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Error', 'Promise', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'document', 'window', 'navigator'],
    python: ['print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'type', 'isinstance', 'abs', 'max', 'min', 'sum', 'sorted', 'reversed', 'enumerate', 'zip', 'map', 'filter', 'open', 'input', 'help', 'dir', 'id', 'hash', 'round', 'pow', 'divmod'],
    java: ['System', 'out', 'println', 'print', 'printf', 'Scanner', 'String', 'Integer', 'Double', 'Boolean', 'Character', 'Long', 'Float', 'Short', 'Byte', 'Math', 'Arrays', 'ArrayList', 'HashMap', 'HashSet', 'LinkedList', 'Collections', 'Objects', 'StringBuilder'],
    go: ['fmt', 'Println', 'Printf', 'Print', 'Sprintf', 'Scanln', 'Scanf', 'len', 'cap', 'append', 'copy', 'delete', 'make', 'new', 'panic', 'recover', 'close', 'complex', 'real', 'imag', 'int', 'string', 'float64', 'float32', 'bool', 'error', 'nil'],
    rust: ['println!', 'print!', 'format!', 'vec!', 'Some', 'None', 'Ok', 'Err', 'Vec', 'String', 'Option', 'Result', 'Box', 'Rc', 'Arc', 'Cell', 'RefCell', 'Mutex', 'RwLock', 'Clone', 'Copy', 'Debug', 'Display', 'Default', 'PartialEq', 'Eq', 'PartialOrd', 'Ord'],
    ruby: ['puts', 'print', 'p', 'pp', 'gets', 'chomp', 'to_s', 'to_i', 'to_f', 'to_a', 'to_h', 'length', 'size', 'each', 'map', 'select', 'reject', 'find', 'find_all', 'reduce', 'inject', 'sort', 'reverse', 'gsub', 'sub', 'split', 'join'],
    php: ['echo', 'print', 'printf', 'sprintf', 'var_dump', 'print_r', 'count', 'strlen', 'strpos', 'str_replace', 'substr', 'trim', 'explode', 'implode', 'array', 'is_array', 'is_string', 'is_int', 'is_float', 'is_bool', 'is_null', 'empty', 'isset', 'unset', 'require', 'include'],
    shell: ['echo', 'printf', 'read', 'cd', 'ls', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'find', 'sed', 'awk', 'sort', 'uniq', 'wc', 'head', 'tail', 'cut', 'tr', 'tee', 'xargs'],
    yaml: [],
    xml: [],
    sql: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'FIRST', 'LAST', 'UPPER', 'LOWER', 'LEN', 'MID', 'ROUND', 'NOW', 'FORMAT', 'CURDATE', 'CURTIME', 'DATE', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'],
  };

  if (language === 'json') {
    result = result
      .replace(/"([^"]+)":/g, '<span class="tok-property">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="tok-string">"$1"</span>')
      .replace(/: (true|false)/g, ': <span class="tok-boolean">$1</span>')
      .replace(/: (null)/g, ': <span class="tok-null">$1</span>')
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="tok-number">$1</span>');
  } else if (language === 'html' || language === 'xml') {
    result = result
      .replace(/&lt;(\/?[a-zA-Z][a-zA-Z0-9-]*)/g, '<span class="tok-tag">&lt;$1</span>')
      .replace(/([a-zA-Z-]+)=&quot;([^&]*)&quot;/g, '<span class="tok-property">$1</span>=<span class="tok-string">&quot;$2&quot;</span>')
      .replace(/(\/?)&gt;/g, '<span class="tok-tag">$1&gt;</span>');
  } else if (language === 'css') {
    result = result
      .replace(/([a-zA-Z-]+):/g, '<span class="tok-property">$1</span>:')
      .replace(/#[0-9a-fA-F]{3,8}/g, '<span class="tok-number">$&</span>')
      .replace(/\b(\d+\.?\d*px|\d+\.?\d*em|\d+\.?\d*rem|\d+\.?\d*%|\d+\.?\d*vh|\d+\.?\d*vw)\b/g, '<span class="tok-number">$1</span>')
      .replace(/([a-zA-Z-]+)\s*\{/g, '<span class="tok-selector">$1</span> {');
  } else {
    const langKeywords = keywords[language] || keywords.javascript;
    const langBuiltins = builtins[language] || [];

    result = result.replace(/(\/\/[^\n]*)/g, '<span class="tok-comment">$1</span>');
    result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>');
    result = result.replace(/#[^\n]*/g, (match) => {
      if (language === 'python' || language === 'ruby' || language === 'shell' || language === 'yaml') {
        return `<span class="tok-comment">${match}</span>`;
      }
      return match;
    });

    result = result.replace(/"([^"\\]|\\.)*"/g, '<span class="tok-string">$&</span>');
    result = result.replace(/'([^'\\]|\\.)*'/g, '<span class="tok-string">$&</span>');
    result = result.replace(/`([^`\\]|\\.)*`/g, '<span class="tok-string">$&</span>');

    result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-number">$1</span>');

    for (const kw of langKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'g');
      result = result.replace(regex, `<span class="tok-keyword">${kw}</span>`);
    }

    for (const bi of langBuiltins) {
      const regex = new RegExp(`\\b${bi}\\b`, 'g');
      result = result.replace(regex, `<span class="tok-function">${bi}</span>`);
    }

    if (language === 'javascript' || language === 'typescript') {
      result = result.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, '<span class="tok-function">$1</span>(');
    } else if (language === 'python') {
      result = result.replace(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, 'def <span class="tok-function">$1</span>');
    } else if (language === 'java') {
      result = result.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '<span class="tok-function">$1</span>(');
    } else if (language === 'go') {
      result = result.replace(/func\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, 'func <span class="tok-function">$1</span>');
    } else if (language === 'rust') {
      result = result.replace(/fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, 'fn <span class="tok-function">$1</span>');
    } else if (language === 'ruby') {
      result = result.replace(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, 'def <span class="tok-function">$1</span>');
    } else if (language === 'php') {
      result = result.replace(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, 'function <span class="tok-function">$1</span>');
    }
  }

  return result;
}

const Playgrounds: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [useLocalModels, setUseLocalModels] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('chat');
  const [capability, setCapability] = useState<CapabilityMode>('fast');
  const [modelOpen, setModelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<LocalAppSettings>(loadSettings());
  const [isRecording, setIsRecording] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>(() => loadCanvasState());
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('oxygenclaw:canvas-sidebar-width');
      return saved ? parseInt(saved, 10) : 400;
    } catch {
      return 400;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(() => {
    try {
      const saved = localStorage.getItem('oxygenclaw:canvas-editor-font-size');
      return (saved as 'sm' | 'md' | 'lg' | 'xl') || 'md';
    } catch {
      return 'md';
    }
  });
  const [imageGenMode, setImageGenMode] = useState(false);
  const [imageGenParams, setImageGenParams] = useState<ImageGenerationParams>({
    size: '1024x1024',
    steps: 20,
    cfgScale: 7.5,
    quality: 'standard',
    negativePrompt: '',
  });
  const [showImageGenParams, setShowImageGenParams] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [_useBackendConversations, setUseBackendConversations] = useState(false);
  const [isCancellingTask, setIsCancellingTask] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const taskHistoryRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);
  const codeEditorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const init = async () => {
      setConversations(loadConversations());
      fetchModels();
      fetchSettings();
      const backendAvailable = await fetchConversationsFromBackend();
      if (!backendAvailable) {
        setConversations(loadConversations());
      }
      fetchAgentTasks();
    };
    init();
  }, []);

  useEffect(() => {
    saveSettings(appSettings);
  }, [appSettings]);

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

  const fetchSettings = async () => {
    try {
      const result = await settingsApi.get();
      if (result.success && result.data) {
        const apiSettings = result.data as any;
        const newSettings: LocalAppSettings = {
          ...appSettings,
          visionEnabled: !!apiSettings.vision_enabled,
          visionApiKey: apiSettings.vision_api_key || '',
          visionBaseUrl: apiSettings.vision_base_url || '',
          visionModel: apiSettings.vision_model || '',
          asrEnabled: !!apiSettings.asr_enabled,
          asrApiKey: apiSettings.asr_api_key || '',
          asrBaseUrl: apiSettings.asr_base_url || '',
          asrModel: apiSettings.asr_model || '',
          ttsEnabled: !!apiSettings.tts_enabled,
          ttsApiKey: apiSettings.tts_api_key || '',
          ttsBaseUrl: apiSettings.tts_base_url || '',
          ttsModel: apiSettings.tts_model || '',
          ttsVoice: apiSettings.tts_voice || '',
          voiceInputEnabled: !!apiSettings.voice_input_enabled,
          voiceOutputEnabled: !!apiSettings.voice_output_enabled,
          imageGenEnabled: !!apiSettings.image_gen_enabled,
          imageGenApiKey: apiSettings.image_gen_api_key || '',
          imageGenBaseUrl: apiSettings.image_gen_base_url || '',
          imageGenModel: apiSettings.image_gen_model || '',
          imageGenDefaultSize: apiSettings.image_gen_default_size || '1024x1024',
          imageGenDefaultSteps: apiSettings.image_gen_default_steps || 20,
          imageGenDefaultCfgScale: apiSettings.image_gen_default_cfg_scale || 7.5,
          imageGenDefaultQuality: apiSettings.image_gen_default_quality || 'standard',
        };
        setAppSettings(newSettings);
      }
    } catch {
    }
  };

  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const result = await llmApi.getModels();
      if (result.success && result.data && result.data.models && result.data.models.length > 0) {
        setModels(result.data.models);
        setUseLocalModels(false);
      } else {
        const providers = loadProviders();
        const enabledModels = getEnabledModels(providers);
        setModels(enabledModels);
        setUseLocalModels(providers.length > 0);
      }
    } catch {
      const providers = loadProviders();
      const enabledModels = getEnabledModels(providers);
      setModels(enabledModels);
      setUseLocalModels(providers.length > 0);
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvId, conversations]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const selectedModel = models.find(m => m.id === activeConv?.modelId);

  const createNewConversation = () => {
    const conv: Conversation = {
      id: generateId(),
      title: '新对话',
      mode: interactionMode,
      capability,
      modelId: models[0]?.id || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    setInput('');
  };

  const updateConv = (id: string, updates: Partial<Conversation>) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)
    );
  };

  const deleteConv = (id: string) => {
    if (!confirm('确定要删除这个对话吗？')) return;
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
  };

  const startRename = (conv: Conversation) => {
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
    setMenuOpen(null);
  };

  const saveRename = () => {
    if (editingConvId && editingTitle.trim()) {
      updateConv(editingConvId, { title: editingTitle.trim() });
    }
    setEditingConvId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let openedCount = 0;

    for (const file of Array.from(files)) {
      if (!isSupportedFile(file.name)) continue;

      try {
        const content = await file.text();
        addFileFromContent(file.name, content);
        openedCount++;
      } catch {
        continue;
      }
    }

    if (openedCount > 0) {
      showToast({
        type: 'success',
        title: '文件已打开',
        description: `已在 Canvas 中打开 ${openedCount} 个文件`,
      });
    }

    e.target.value = '';
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!activeConvId) {
      createNewConversation();
    }

    const convId = activeConvId || conversations[0]?.id;
    if (!convId) return;

    const currentConv = conversations.find(c => c.id === convId);
    if (!currentConv) return;

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        id: generateId(),
        type: 'image',
        name: file.name,
        size: file.size,
        dataUrl,
      });
    }

    if (newAttachments.length === 0) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      attachments: newAttachments,
    };

    const newMessages = [...currentConv.messages, userMsg];
    updateConv(convId, { messages: newMessages });
    setInput('');
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
    updateConv(convId, { messages: [...newMessages, assistantMsg] });

    try {
      if (interactionMode === 'chat') {
        const selectedModel = models.find(m => m.id === currentConv.modelId);
        const useDedicatedVision = appSettings.visionEnabled && !selectedModel?.supportsVision;

        let apiMessages: any[];
        if (useDedicatedVision) {
          apiMessages = newMessages.map(m => ({
            role: m.role,
            content: m.content,
          }));
        } else {
          apiMessages = newMessages.map(m => {
            if (m.attachments && m.attachments.length > 0) {
              const content: any[] = [];
              if (m.content) {
                content.push({ type: 'text', text: m.content });
              }
              for (const att of m.attachments) {
                if (att.type === 'image' && att.dataUrl) {
                  content.push({
                    type: 'image_url',
                    image_url: { url: att.dataUrl, detail: 'auto' },
                  });
                }
              }
              return { role: m.role, content };
            }
            return { role: m.role, content: m.content };
          });
        }

        const modelId = currentConv.modelId || models[0]?.id;

        const onMessage = (_chunk: string, data: any) => {
          const content = data?.choices?.[0]?.delta?.content || data?.content || '';
          const reasoningContent = data?.choices?.[0]?.delta?.reasoning_content || data?.reasoning_content || '';
          
          if (content || reasoningContent) {
            setConversations(prev =>
              prev.map(c => {
                if (c.id !== convId) return c;
                const updatedMessages = c.messages.map(m => {
                  if (m.id === assistantMsgId) {
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
                  }
                  return m;
                });
                return { ...c, messages: updatedMessages, updatedAt: Date.now() };
              })
            );
          }
        };

        const onComplete = () => {
          setIsLoading(false);
          setConversations(prev =>
            prev.map(c => {
              if (c.id !== convId) return c;
              const updatedMessages = c.messages.map(m => {
                if (m.id === assistantMsgId) {
                  return { ...m, reasoningEndTime: m.reasoningEndTime || Date.now() };
                }
                return m;
              });
              return { ...c, messages: updatedMessages, updatedAt: Date.now() };
            })
          );
        };

        const onError = (error: string) => {
          setIsLoading(false);
          showToast({ type: 'error', title: '请求失败', description: error });
          setConversations(prev =>
            prev.map(c => {
              if (c.id !== convId) return c;
              const updatedMessages = c.messages.map(m => {
                if (m.id === assistantMsgId) {
                  return { ...m, content: `错误: ${error}` };
                }
                return m;
              });
              return { ...c, messages: updatedMessages, updatedAt: Date.now() };
            })
          );
        };

        if (useLocalModels) {
          const { providerId, modelId: modelName } = directLlmApi.parseModelId(modelId);
          directLlmApi.directChatCompletionsStream(
            providerId,
            modelName,
            apiMessages,
            {
              temperature: 0.7,
            },
            {
              onMessage,
              onComplete,
              onError,
            }
          );
        } else {
          await llmApi.chatCompletionsStream(
            {
              model: modelId,
              messages: apiMessages,
              temperature: 0.7,
              stream: true,
            },
            onMessage,
            onComplete,
            onError
          );
        }
      }
    } catch (e: any) {
      setIsLoading(false);
      showToast({ type: 'error', title: '请求失败', description: e?.message });
    }

    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        setIsLoading(true);
        try {
          const result = await multimodalApi.transcribeAudio(base64, 'webm');
          if (result.success && result.data) {
            setInput(prev => prev + (prev ? ' ' : '') + result.data!.text);
          } else {
            showToast({ type: 'error', title: '语音识别失败', description: result.error });
          }
        } catch (e: any) {
          showToast({ type: 'error', title: '语音识别失败', description: e?.message });
        } finally {
          setIsLoading(false);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e: any) {
      showToast({ type: 'error', title: '无法访问麦克风', description: e?.message });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const speakMessage = async (message: ChatMessage) => {
    if (!message.content) return;

    if (speakingId === message.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setSpeakingId(null);
      return;
    }

    if (speakingId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsSynthesizing(true);
    setSpeakingId(message.id);

    try {
      const result = await multimodalApi.synthesizeSpeech(message.content, appSettings.ttsVoice || undefined);
      if (result.success && result.data) {
        const audio = new Audio(`data:audio/${result.data.format};base64,${result.data.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => {
          setSpeakingId(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setSpeakingId(null);
          audioRef.current = null;
          showToast({ type: 'error', title: '播放失败', description: '音频播放出错' });
        };
        await audio.play();
      } else {
        showToast({ type: 'error', title: '语音合成失败', description: result.error });
        setSpeakingId(null);
      }
    } catch (e: any) {
      showToast({ type: 'error', title: '语音合成失败', description: e?.message });
      setSpeakingId(null);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!input.trim()) return;

    if (models.length === 0) {
      showToast({
        type: 'error',
        title: '未配置模型',
        description: '请先在模型管理中添加并启用至少一个生图模型',
      });
      return;
    }

    let convId = activeConvId;
    if (!convId) {
      const conv: Conversation = {
        id: generateId(),
        title: input.slice(0, 20) + (input.length > 20 ? '...' : ''),
        mode: interactionMode,
        capability,
        modelId: models.find(m => m.supportsImageGeneration)?.id || models[0]?.id || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      setConversations(prev => [conv, ...prev]);
      convId = conv.id;
      setActiveConvId(conv.id);
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const currentConv = conversations.find(c => c.id === convId);
    if (!currentConv) return;

    const newMessages = [...currentConv.messages, userMsg];
    updateConv(convId, { messages: newMessages });
    setInput('');
    setIsGeneratingImage(true);

    const assistantMsgId = generateId();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      generatedImages: [],
    };
    updateConv(convId, { messages: [...newMessages, assistantMsg] });

    try {
      const modelId = currentConv.modelId || models.find(m => m.supportsImageGeneration)?.id || models[0]?.id;
      
      let result;
      if (useLocalModels) {
        const { providerId, modelId: modelName } = directLlmApi.parseModelId(modelId);
        result = await directLlmApi.directGenerateImage(
          providerId,
          modelName,
          userMsg.content,
          {
            size: imageGenParams.size,
            steps: imageGenParams.steps,
            cfg_scale: imageGenParams.cfgScale,
            quality: imageGenParams.quality,
            negative_prompt: imageGenParams.negativePrompt || undefined,
            n: 1,
          }
        );
      } else {
        result = await llmApi.generateImage({
          prompt: userMsg.content,
          model: modelId,
          size: imageGenParams.size,
          steps: imageGenParams.steps,
          cfg_scale: imageGenParams.cfgScale,
          quality: imageGenParams.quality,
          negative_prompt: imageGenParams.negativePrompt || undefined,
          n: 1,
        });
      }

      if (result.success && result.data) {
        const generatedImages: GeneratedImage[] = (result.data as any).data.map((img: any, idx: number) => ({
          id: `img-${Date.now()}-${idx}`,
          url: img.b64_json ? `data:image/png;base64,${img.b64_json}` : img.url || '',
          prompt: userMsg.content,
          model: modelId || '',
          size: imageGenParams.size,
          steps: imageGenParams.steps,
          cfgScale: imageGenParams.cfgScale,
          timestamp: Date.now(),
        }));

        setConversations(prev =>
          prev.map(c => {
            if (c.id !== convId) return c;
            const updatedMessages = c.messages.map(m => {
              if (m.id === assistantMsgId) {
                return {
                  ...m,
                  content: `已生成 ${generatedImages.length} 张图片\n\n尺寸: ${imageGenParams.size}\n步数: ${imageGenParams.steps}\nCFG Scale: ${imageGenParams.cfgScale}`,
                  generatedImages,
                };
              }
              return m;
            });
            return { ...c, messages: updatedMessages, updatedAt: Date.now() };
          })
        );
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (e: any) {
      setConversations(prev =>
        prev.map(c => {
          if (c.id !== convId) return c;
          const updatedMessages = c.messages.map(m => {
            if (m.id === assistantMsgId) {
              return { ...m, content: `生成失败: ${e?.message || '未知错误'}` };
            }
            return m;
          });
          return { ...c, messages: updatedMessages, updatedAt: Date.now() };
        })
      );
      showToast({ type: 'error', title: '图片生成失败', description: e?.message });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const downloadImage = (imageUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast({ type: 'success', title: '图片已下载' });
  };

  const regenerateImage = (prompt: string) => {
    setInput(prompt);
    handleGenerateImage();
  };

  const toggleImageGenMode = () => {
    const newMode = !imageGenMode;
    setImageGenMode(newMode);
    if (newMode) {
      const imgModel = models.find(m => m.supportsImageGeneration);
      if (imgModel && activeConvId) {
        updateConv(activeConvId, { modelId: imgModel.id });
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    if (models.length === 0) {
      showToast({
        type: 'error',
        title: '未配置模型',
        description: '请先在模型管理中添加并启用至少一个模型',
      });
      return;
    }

    let convId = activeConvId;
    if (!convId) {
      const conv: Conversation = {
        id: generateId(),
        title: input.slice(0, 20) + (input.length > 20 ? '...' : ''),
        mode: interactionMode,
        capability,
        modelId: models[0]?.id || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      setConversations(prev => [conv, ...prev]);
      convId = conv.id;
      setActiveConvId(conv.id);
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const currentConv = conversations.find(c => c.id === convId);
    if (!currentConv) return;

    const newMessages = [...currentConv.messages, userMsg];
    updateConv(convId, { messages: newMessages });
    setInput('');
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
    updateConv(convId, { messages: [...newMessages, assistantMsg] });

    try {
      if (interactionMode === 'chat') {
        const apiMessages: ApiChatMessage[] = newMessages.map(m => ({
          role: m.role,
          content: m.content,
        }));

        const modelId = currentConv.modelId || models[0]?.id;

        const onMessage = (_chunk: string, data: any) => {
          const content = data?.choices?.[0]?.delta?.content || data?.content || '';
          const reasoningContent = data?.choices?.[0]?.delta?.reasoning_content || data?.reasoning_content || '';
          
          if (content || reasoningContent) {
            setConversations(prev =>
              prev.map(c => {
                if (c.id !== convId) return c;
                const updatedMessages = c.messages.map(m => {
                  if (m.id === assistantMsgId) {
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
                  }
                  return m;
                });
                return { ...c, messages: updatedMessages, updatedAt: Date.now() };
              })
            );
          }
        };

        const onComplete = () => {
          setIsLoading(false);
          setConversations(prev =>
            prev.map(c => {
              if (c.id !== convId) return c;
              const updatedMessages = c.messages.map(m => {
                if (m.id === assistantMsgId) {
                  return { ...m, reasoningEndTime: m.reasoningEndTime || Date.now() };
                }
                return m;
              });
              return { ...c, messages: updatedMessages, updatedAt: Date.now() };
            })
          );
        };

        const onError = (error: string) => {
          setIsLoading(false);
          showToast({ type: 'error', title: '请求失败', description: error });
          setConversations(prev =>
            prev.map(c => {
              if (c.id !== convId) return c;
              const updatedMessages = c.messages.map(m => {
                if (m.id === assistantMsgId) {
                  return { ...m, content: `错误: ${error}` };
                }
                return m;
              });
              return { ...c, messages: updatedMessages, updatedAt: Date.now() };
            })
          );
        };

        if (useLocalModels) {
          const { providerId, modelId: modelName } = directLlmApi.parseModelId(modelId);
          directLlmApi.directChatCompletionsStream(
            providerId,
            modelName,
            apiMessages,
            {
              temperature: 0.7,
            },
            {
              onMessage,
              onComplete,
              onError,
            }
          );
        } else {
          await llmApi.chatCompletionsStream(
            {
              model: modelId,
              messages: apiMessages,
              temperature: 0.7,
              stream: true,
            },
            onMessage,
            onComplete,
            onError
          );
        }
      } else if (interactionMode === 'task') {
        const modelId = currentConv.modelId || models[0]?.id;
        await handleAgentExecute(convId, userMsg.content, modelId, currentConv.capability);
      } else if (interactionMode === 'computeruse') {
        const modelId = currentConv.modelId || models[0]?.id;
        await handleComputerUseExecute(convId, userMsg.content, modelId);
      }
    } catch (e: any) {
      setIsLoading(false);
      showToast({ type: 'error', title: '请求失败', description: e?.message });
    }
  };

  const fetchAgentTasks = async () => {
    try {
      const result = await agentApi.getTasks();
      if (result.success && result.data) {
        setAgentTasks(result.data);
      }
    } catch {
    }
  };

  const fetchConversationsFromBackend = async () => {
    try {
      const result = await conversationApi.list();
      if (result.success && result.data && result.data.length > 0) {
        setUseBackendConversations(true);
        const backendConvs: Conversation[] = result.data.map((conv: any) => ({
          id: conv.id,
          title: conv.title || '新对话',
          mode: (conv.mode as 'chat' | 'task' | 'computeruse') || 'chat',
          capability: 'fast',
          modelId: conv.modelId || models[0]?.id || '',
          createdAt: new Date(conv.createdAt).getTime(),
          updatedAt: new Date(conv.updatedAt).getTime(),
          messages: conv.messages?.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp).getTime(),
          })) || [],
        }));
        setConversations(backendConvs);
        return true;
      }
    } catch {
    }
    return false;
  };

  const addAgentStep = (convId: string, step: AgentStep, isComputerUse: boolean = false) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== convId) return c;
        const key = isComputerUse ? 'computerUseSteps' : 'agentSteps';
        const steps = c[key] || [];
        return {
          ...c,
          [key]: [...steps, step],
          updatedAt: Date.now(),
        };
      })
    );
  };

  const updateAgentStep = (convId: string, stepId: string, updates: Partial<AgentStep>, isComputerUse: boolean = false) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== convId) return c;
        const key = isComputerUse ? 'computerUseSteps' : 'agentSteps';
        const steps = (c[key] || []).map(s =>
          s.id === stepId ? { ...s, ...updates } : s
        );
        return {
          ...c,
          [key]: steps,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const toggleReasoningExpanded = (msgId: string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const formatJson = (obj: any): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const getStepIcon = (type: AgentStep['type']) => {
    switch (type) {
      case 'think':
        return Brain;
      case 'tool':
      case 'tool_call':
        return Zap;
      case 'tool_result':
        return CheckCircle;
      case 'action':
        return MousePointer;
      case 'result':
      case 'final':
        return CheckCircle;
      case 'error':
        return XCircle;
      case 'screenshot':
        return ImageUploadIcon;
      case 'plan':
        return FileText;
      case 'observe':
        return Eye;
      default:
        return Brain;
    }
  };

  const getStepTypeLabel = (type: AgentStep['type']): string => {
    switch (type) {
      case 'think':
        return '思考';
      case 'tool':
      case 'tool_call':
        return '工具调用';
      case 'tool_result':
        return '工具结果';
      case 'action':
        return '动作';
      case 'result':
      case 'final':
        return '结果';
      case 'error':
        return '错误';
      case 'screenshot':
        return '截图';
      case 'plan':
        return '计划';
      case 'observe':
        return '观察';
      default:
        return '步骤';
    }
  };

  const getStatusIcon = (status: AgentStep['status']) => {
    switch (status) {
      case 'running':
        return Loader2;
      case 'completed':
        return CheckCircle;
      case 'failed':
        return XCircle;
      case 'pending':
        return Clock;
      default:
        return Clock;
    }
  };

  const getStatusClass = (status: AgentStep['status']): string => {
    switch (status) {
      case 'running':
        return 'step-status-running';
      case 'completed':
        return 'step-status-completed';
      case 'failed':
        return 'step-status-failed';
      case 'pending':
        return 'step-status-pending';
      default:
        return 'step-status-pending';
    }
  };

  const canExpandStep = (step: AgentStep): boolean => {
    if (step.content && step.content.length > 100) return true;
    if (step.toolParams) return true;
    if (step.toolResult) return true;
    if (step.toolDescription) return true;
    if (step.actionParams) return true;
    if (step.screenshot) return true;
    if (step.type === 'screenshot') return true;
    return false;
  };

  const getStepSummary = (step: AgentStep): string => {
    if (step.toolName) return step.toolName;
    if (step.actionType) {
      const actionLabels: Record<string, string> = {
        click: '点击',
        type: '输入',
        scroll: '滚动',
        keypress: '按键',
        navigate: '导航',
        other: '其他',
      };
      return actionLabels[step.actionType] || step.actionType;
    }
    if (step.content && step.content.length > 60) {
      return step.content.slice(0, 60) + '...';
    }
    return step.content || '';
  };

  const cancelCurrentTask = async () => {
    if (!activeConvId) return;
    const conv = conversations.find(c => c.id === activeConvId);
    if (!conv?.taskId) return;

    setIsCancellingTask(true);
    try {
      const result = await agentApi.cancelTask(conv.taskId);
      if (result.success) {
        showToast({ type: 'success', title: '任务已取消' });
        setIsLoading(false);
        fetchAgentTasks();
      } else {
        showToast({ type: 'error', title: '取消失败', description: result.error });
      }
    } catch (e: any) {
      showToast({ type: 'error', title: '取消失败', description: e?.message });
    } finally {
      setIsCancellingTask(false);
    }
  };

  const handleComputerUseExecute = async (convId: string, task: string, modelId: string) => {
    const stepId = generateId();
    const firstStep: AgentStep = {
      id: stepId,
      type: 'plan',
      title: '分析任务',
      content: '正在分析任务目标，规划执行步骤...',
      status: 'running',
      timestamp: Date.now(),
    };
    addAgentStep(convId, firstStep, true);

    try {
      await agentApi.executeComputerUse({
        task,
        modelId,
        onMessage: (data: any) => {
          if (data.type === 'step' || data.step) {
            const stepData = data.step || data;
            const stepType = stepData.type;
            let mappedType: AgentStep['type'] = 'think';
            
            if (stepType === 'action') mappedType = 'action';
            else if (stepType === 'screenshot') mappedType = 'screenshot';
            else if (stepType === 'plan') mappedType = 'plan';
            else if (stepType === 'observe') mappedType = 'observe';
            else if (stepType === 'result' || stepType === 'final') mappedType = 'result';
            else if (stepType === 'error') mappedType = 'error';
            else if (stepType === 'think') mappedType = 'think';
            
            const newStep: AgentStep = {
              id: stepData.id || generateId(),
              type: mappedType,
              title: stepData.title || stepData.description || stepData.name || '',
              content: stepData.content || stepData.description || stepData.text || '',
              status: stepData.status || 'running',
              timestamp: Date.now(),
              screenshot: stepData.screenshot,
              actionType: stepData.actionType,
              actionParams: stepData.params || stepData.actionParams,
              executionTime: stepData.executionTime || stepData.duration,
            };
            addAgentStep(convId, newStep, true);
          } else if (data.type === 'update' || data.status) {
            const stepIdToUpdate = data.stepId || (conversations.find(c => c.id === convId)?.computerUseSteps?.slice(-1)[0]?.id);
            if (stepIdToUpdate) {
              const updates: Partial<AgentStep> = {
                status: data.status,
                content: data.content || undefined,
              };
              if (data.screenshot !== undefined) {
                updates.screenshot = data.screenshot;
              }
              if (data.executionTime !== undefined || data.duration !== undefined) {
                updates.executionTime = data.executionTime || data.duration;
              }
              if (data.params !== undefined || data.actionParams !== undefined) {
                updates.actionParams = data.params || data.actionParams;
              }
              updateAgentStep(convId, stepIdToUpdate, updates, true);
            }
          } else if (data.content || data.delta || data.text) {
            const content = data.content || data.delta || data.text || '';
            if (content && typeof content === 'string') {
              setConversations(prev =>
                prev.map(c => {
                  if (c.id !== convId) return c;
                  const lastMsg = c.messages[c.messages.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    const updatedMessages = c.messages.map(m => {
                      if (m.id === lastMsg.id) {
                        return { ...m, content: m.content + content };
                      }
                      return m;
                    });
                    return { ...c, messages: updatedMessages, updatedAt: Date.now() };
                  }
                  return c;
                })
              );
            }
          } else if (data.taskId) {
            setConversations(prev =>
              prev.map(c => c.id === convId ? { ...c, taskId: data.taskId } : c)
            );
          }
        },
      }, undefined, () => {
        setIsLoading(false);
        updateAgentStep(convId, stepId, { status: 'completed' }, true);
        fetchAgentTasks();
      }, (error) => {
        setIsLoading(false);
        showToast({ type: 'error', title: 'Computer Use 执行失败', description: error });
        updateAgentStep(convId, stepId, { status: 'failed', content: error }, true);
      });
    } catch (e: any) {
      setIsLoading(false);
      showToast({ type: 'error', title: '请求失败', description: e?.message });
    }
  };

  const handleAgentExecute = async (convId: string, prompt: string, modelId: string, capability: CapabilityMode) => {
    const stepId = generateId();
    const firstStep: AgentStep = {
      id: stepId,
      type: 'think',
      title: '规划任务',
      content: '正在分析需求，规划执行方案...',
      status: 'running',
      timestamp: Date.now(),
    };
    addAgentStep(convId, firstStep, false);

    try {
      await agentApi.execute(
        {
          prompt,
          mode: 'task',
          capability,
          modelId,
          onMessage: (data: any) => {
            if (data.type === 'step' || data.step) {
              const stepData = data.step || data;
              const stepType = stepData.type;
              let mappedType: AgentStep['type'] = 'think';
              
              if (stepType === 'tool' || stepType === 'tool_call') mappedType = 'tool_call';
              else if (stepType === 'tool_result') mappedType = 'tool_result';
              else if (stepType === 'result' || stepType === 'final') mappedType = 'final';
              else if (stepType === 'error') mappedType = 'error';
              else if (stepType === 'think') mappedType = 'think';
              
              const newStep: AgentStep = {
                id: stepData.id || generateId(),
                type: mappedType,
                title: stepData.title || stepData.name || stepData.toolName || '',
                content: stepData.content || stepData.description || stepData.text || '',
                status: stepData.status || 'running',
                timestamp: Date.now(),
                toolName: stepData.toolName || stepData.name || (stepType === 'tool' || stepType === 'tool_call' ? stepData.title : undefined),
                toolParams: stepData.params || stepData.arguments || stepData.toolParams,
                toolResult: stepData.result || stepData.output || stepData.toolResult,
                toolDescription: stepData.description || stepData.toolDescription,
                executionTime: stepData.executionTime || stepData.duration,
              };
              addAgentStep(convId, newStep, false);
            } else if (data.type === 'update' && data.stepId) {
              const updates: Partial<AgentStep> = {
                status: data.status,
                content: data.content || undefined,
              };
              if (data.result !== undefined || data.output !== undefined || data.toolResult !== undefined) {
                updates.toolResult = data.result || data.output || data.toolResult;
              }
              if (data.executionTime !== undefined || data.duration !== undefined) {
                updates.executionTime = data.executionTime || data.duration;
              }
              if (data.params !== undefined || data.arguments !== undefined || data.toolParams !== undefined) {
                updates.toolParams = data.params || data.arguments || data.toolParams;
              }
              updateAgentStep(convId, data.stepId, updates, false);
            } else if (data.content || data.delta || data.text) {
              const content = data.content || data.delta || data.text || '';
              if (content && typeof content === 'string') {
                setConversations(prev =>
                  prev.map(c => {
                    if (c.id !== convId) return c;
                    const lastMsg = c.messages[c.messages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                      const updatedMessages = c.messages.map(m => {
                        if (m.id === lastMsg.id) {
                          return { ...m, content: m.content + content };
                        }
                        return m;
                      });
                      return { ...c, messages: updatedMessages, updatedAt: Date.now() };
                    }
                    return c;
                  })
                );
              }
            } else if (data.taskId) {
              setConversations(prev =>
                prev.map(c => c.id === convId ? { ...c, taskId: data.taskId } : c)
              );
            }
          },
        },
        undefined,
        () => {
          setIsLoading(false);
          updateAgentStep(convId, stepId, { status: 'completed' }, false);
          fetchAgentTasks();
        },
        (error) => {
          setIsLoading(false);
          showToast({ type: 'error', title: 'Agent 执行失败', description: error });
          updateAgentStep(convId, stepId, { status: 'failed', content: error }, false);
        }
      );
    } catch (e: any) {
      setIsLoading(false);
      showToast({ type: 'error', title: '请求失败', description: e?.message });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCapabilitySwitch = (mode: CapabilityMode) => {
    setCapability(mode);
    if (activeConvId) {
      updateConv(activeConvId, { capability: mode });
    }
  };

  const selectModel = (modelId: string) => {
    if (activeConvId) {
      updateConv(activeConvId, { modelId });
    }
    setModelOpen(false);
  };

  const toggleCanvas = () => {
    setCanvasState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  };

  const openFile = (file: CanvasFile) => {
    setCanvasState(prev => {
      const exists = prev.files.find(f => f.id === file.id);
      let newFiles = prev.files;
      if (!exists) {
        newFiles = [...prev.files, file];
      }
      return {
        ...prev,
        isOpen: true,
        activeFileId: file.id,
        files: newFiles,
      };
    });
  };

  const closeFile = (fileId: string) => {
    setCanvasState(prev => {
      const newFiles = prev.files.filter(f => f.id !== fileId);
      let newActiveId = prev.activeFileId;
      if (prev.activeFileId === fileId) {
        const idx = prev.files.findIndex(f => f.id === fileId);
        if (idx > 0) {
          newActiveId = prev.files[idx - 1].id;
        } else if (newFiles.length > 0) {
          newActiveId = newFiles[0].id;
        } else {
          newActiveId = null;
        }
      }
      return {
        ...prev,
        files: newFiles,
        activeFileId: newActiveId,
      };
    });
  };

  const setActiveFile = (fileId: string) => {
    setCanvasState(prev => ({ ...prev, activeFileId: fileId }));
  };

  const updateFileContent = (fileId: string, content: string) => {
    setCanvasState(prev => ({
      ...prev,
      files: prev.files.map(f =>
        f.id === fileId ? { ...f, content, updatedAt: Date.now() } : f
      ),
    }));
  };

  const setViewMode = (mode: 'edit' | 'preview') => {
    setCanvasState(prev => ({ ...prev, viewMode: mode }));
  };

  const addFileFromContent = (name: string, content: string) => {
    const fileInfo = getFileInfo(name);
    const newFile: CanvasFile = {
      id: generateId(),
      name,
      type: fileInfo.type,
      content,
      language: fileInfo.language,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    openFile(newFile);
    return newFile;
  };

  const runCode = () => {
    const activeFile = canvasState.files.find(f => f.id === canvasState.activeFileId);
    if (!activeFile) return;

    setCanvasState(prev => ({ ...prev, isRunning: true, output: '' }));

    setTimeout(() => {
      let output = '';
      try {
        if (activeFile.language === 'javascript' || activeFile.language === 'typescript') {
          const logs: string[] = [];
          const originalLog = console.log;
          console.log = (...args) => {
            logs.push(args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '));
          };
          try {
            const result = new Function(activeFile.content)();
            if (result !== undefined) {
              logs.push(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
            }
          } finally {
            console.log = originalLog;
          }
          output = logs.join('\n') || '(无输出)';
        } else if (activeFile.language === 'json') {
          try {
            const parsed = JSON.parse(activeFile.content);
            output = '✓ JSON 解析成功\n\n' + JSON.stringify(parsed, null, 2);
          } catch (e: any) {
            output = '✗ JSON 解析失败:\n' + e.message;
          }
        } else if (activeFile.language === 'html') {
          output = 'HTML 预览模式 - 在浏览器中打开以查看效果';
        } else {
          output = `模拟运行 ${activeFile.language} 代码...\n\n(当前仅支持 JavaScript/TypeScript 实际执行)\n\n文件内容:\n${activeFile.content.slice(0, 500)}${activeFile.content.length > 500 ? '...' : ''}`;
        }
      } catch (e: any) {
        output = '错误: ' + e.message;
      }
      setCanvasState(prev => ({ ...prev, isRunning: false, output }));
    }, 300);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartX.current - e.clientX;
      let newWidth = resizeStartWidth.current + deltaX;
      const minWidth = 300;
      const maxWidth = Math.floor(window.innerWidth * 0.8);
      newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('oxygenclaw:canvas-sidebar-width', sidebarWidth.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, sidebarWidth]);

  const handleDoubleClickResize = () => {
    setSidebarWidth(400);
    localStorage.setItem('oxygenclaw:canvas-sidebar-width', '400');
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleEditorFontSizeChange = (size: 'sm' | 'md' | 'lg' | 'xl') => {
    setEditorFontSize(size);
    localStorage.setItem('oxygenclaw:canvas-editor-font-size', size);
  };

  const copyCode = async () => {
    const activeFile = canvasState.files.find(f => f.id === canvasState.activeFileId);
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      showToast({ type: 'success', title: '已复制', description: '代码已复制到剪贴板' });
    } catch {
      showToast({ type: 'error', title: '复制失败', description: '无法复制到剪贴板' });
    }
  };

  const downloadFile = () => {
    const activeFile = canvasState.files.find(f => f.id === canvasState.activeFileId);
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ type: 'success', title: '已下载', description: `文件 ${activeFile.name} 已下载` });
  };

  useEffect(() => {
    saveCanvasState(canvasState);
  }, [canvasState.files, canvasState.activeFileId, canvasState.viewMode]);

  const filteredConvs = conversations.filter(c => c.mode === interactionMode);

  const activeCanvasFile = canvasState.files.find(f => f.id === canvasState.activeFileId);

  return (
    <div className={`${isFullscreen ? 'canvas-fullscreen' : 'flex h-[calc(100vh-4rem)]'}`}>
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="canvas-fullscreen-toggle"
        >
          <Minimize2 size={16} />
          退出全屏
        </button>
      )}
      {/* Left sidebar - conversations */}
      {!isFullscreen && (
      <div className="w-72 border-r border-outline-variant bg-surface-variant flex flex-col">
        <div className="p-3 border-b border-outline-variant">
          <button
            onClick={createNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            新建 {interactionMode === 'chat' ? '对话' : interactionMode === 'task' ? '任务' : 'Computer Use'}
          </button>
        </div>

        <div className="p-2">
          <div className="flex justify-center mb-2">
            <div className="inline-flex w-fit bg-surface-variant rounded-full p-0.5 segmented-control">
            <button
              onClick={() => setInteractionMode('chat')}
              className={`flex-none px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors segmented-control-item ${
                interactionMode === 'chat'
                  ? 'bg-surface-container-highest text-on-surface active'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              对话
            </button>
            <button
              onClick={() => setInteractionMode('task')}
              className={`flex-none px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors segmented-control-item ${
                interactionMode === 'task'
                  ? 'bg-surface-container-highest text-on-surface active'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              任务
            </button>
            <button
              onClick={() => setInteractionMode('computeruse')}
              className={`flex-none px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors segmented-control-item ${
                interactionMode === 'computeruse'
                  ? 'bg-surface-container-highest text-on-surface active'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              电脑
            </button>
            </div>
          </div>
          {interactionMode !== 'chat' && (
          <button
            onClick={() => {
              setShowTaskHistory(!showTaskHistory);
              if (!showTaskHistory) {
                fetchAgentTasks();
              }
            }}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              showTaskHistory
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-surface text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
            }`}
          >
            <Clock size={14} />
            任务历史
          </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConvs.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Bot size={28} className="mx-auto text-on-surface-variant opacity-40 mb-2" />
              <div className="text-sm text-on-surface-variant">
                暂无{interactionMode === 'chat' ? '对话' : '任务'}
              </div>
            </div>
          ) : (
            filteredConvs.map(conv => (
              <div
                key={conv.id}
                className={`group relative rounded-lg cursor-pointer transition-colors ${
                  activeConvId === conv.id
                    ? 'bg-primary-container text-on-primary-container'
                    : 'hover:bg-surface text-on-surface'
                }`}
                onClick={() => setActiveConvId(conv.id)}
              >
                {editingConvId === conv.id ? (
                  <div className="p-2.5">
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={saveRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename();
                        if (e.key === 'Escape') setEditingConvId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-sm text-on-surface focus:border-primary focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="p-2.5 pr-8">
                    <div className="text-sm font-medium truncate">{conv.title}</div>
                    <div className="text-xs opacity-70 mt-0.5 truncate flex items-center gap-1">
                      {capabilityModes.find(m => m.id === conv.capability)?.label}
                      <span>·</span>
                      {new Date(conv.updatedAt).toLocaleDateString()}
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
                  className={`absolute right-1.5 top-1/2 p-1.5 rounded-md transition-colors ${
                    activeConvId === conv.id
                      ? 'opacity-100 bg-black/10 hover:bg-black/20'
                      : 'opacity-60 hover:opacity-100 hover:bg-surface-variant/50'
                  }`}
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen === conv.id && (
                  <div
                    ref={el => { if (el) menuRefs.current.set(conv.id, el); }}
                    className="absolute right-1 top-full mt-1 w-36 bg-surface rounded-xl border border-outline-variant shadow-xl py-1.5 z-20 animate-slide-down"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => startRename(conv)}
                      className="w-full px-3.5 py-2 text-left text-sm text-on-surface hover:bg-surface-variant flex items-center gap-2.5 transition-colors"
                    >
                      <Edit2 size={15} /> 重命名
                    </button>
                    <button
                      onClick={() => deleteConv(conv.id)}
                      className="w-full px-3.5 py-2 text-left text-sm text-error hover:bg-error-container/30 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 size={15} /> 删除
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {showTaskHistory && (
          <div
            className="border-t border-outline-variant overflow-y-auto animate-slide-down"
            style={{ resize: 'vertical', minHeight: '8rem', maxHeight: '28rem' }}
            ref={taskHistoryRef}
          >
            <div className="p-2 flex items-center justify-between sticky top-0 bg-surface-variant z-10">
              <span className="text-xs font-medium text-on-surface-variant">任务历史</span>
              <button
                onClick={fetchAgentTasks}
                className="p-1 rounded hover:bg-surface/50 text-on-surface-variant hover:text-on-surface transition-colors"
                title="刷新"
              >
                <RefreshCw size={12} />
              </button>
            </div>
            <div className="p-2 space-y-1">
              {agentTasks.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-on-surface-variant">暂无任务记录</p>
                </div>
              ) : (
                agentTasks.slice(0, 20).map(task => (
                  <div
                    key={task.id}
                    className="p-2 rounded-lg bg-surface hover:bg-surface/80 cursor-pointer transition-colors"
                    onClick={async () => {
                      try {
                        const result = await agentApi.getTask(task.id);
                        if (result.success && result.data) {
                          showToast({ type: 'success', title: '任务详情', description: `状态: ${result.data.status}` });
                        }
                      } catch (e: any) {
                        showToast({ type: 'error', title: '获取失败', description: e?.message });
                      }
                    }}
                  >
                    <div className="text-xs font-medium text-on-surface truncate flex items-center gap-1.5">
                      {task.status === 'running' && <Loader2 size={10} className="animate-spin text-primary" />}
                      {task.status === 'completed' && <CheckCircle size={10} className="text-green-500" />}
                      {task.status === 'failed' && <XCircle size={10} className="text-error" />}
                      {task.status === 'cancelled' && <StopCircle size={10} className="text-on-surface-variant" />}
                      {task.status === 'pending' && <Clock size={10} className="text-on-surface-variant" />}
                      {task.prompt?.slice(0, 30) || task.task?.slice(0, 30) || '未命名任务'}
                      {(task.prompt?.length || task.task?.length || 0) > 30 ? '...' : ''}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                      <span className="capitalize">{task.mode || 'task'}</span>
                      <span>·</span>
                      <span>{new Date(task.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {models.length === 0 && !modelsLoading && (
          <div className="p-3 border-t border-outline-variant">
            <div className="p-3 bg-error-container/30 rounded-lg">
              <div className="text-xs font-medium text-error flex items-center gap-1.5 mb-1">
                <AlertCircle size={12} />
                未配置模型
              </div>
              <p className="text-xs text-on-surface-variant mb-2">
                请先添加 API 提供商并启用模型
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchModels}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={10} />
                  刷新
                </button>
                <span className="text-on-surface-variant text-xs">·</span>
                <button
                  onClick={() => navigate('/models')}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  前往模型管理 →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Main content area */}
      <div className={`flex-1 flex ${isFullscreen ? 'canvas-main-area h-full' : ''}`}>
        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-background min-w-0">
        {/* Top bar */}
        {!isFullscreen && (
        <div className="h-14 border-b border-outline-variant flex items-center justify-between px-4 bg-surface">
          <div className="flex items-center gap-3 min-w-0">
            {/* Session title */}
            <h2 className="text-sm font-medium text-on-surface truncate">
              {activeConv?.title || (interactionMode === 'chat' ? '新对话' : interactionMode === 'task' ? '新任务' : 'Computer Use')}
            </h2>

            {interactionMode === 'computeruse' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-surface-variant rounded-full flex-none">
                <Monitor size={14} className="text-primary" />
                <span className="text-xs font-medium text-on-surface">Computer Use 模式</span>
              </div>
            )}

            {/* Image generation mode toggle */}
            {interactionMode === 'chat' && models.some(m => m.supportsImageGeneration) && (
              <button
                onClick={toggleImageGenMode}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all flex-none ${
                  imageGenMode
                    ? 'bg-tertiary-container text-on-tertiary-container shadow-sm'
                    : 'bg-surface-variant text-on-surface-variant hover:text-on-surface'
                }`}
                title="生图模式"
              >
                <Palette size={12} />
                生图
              </button>
            )}

            {/* Cancel task button */}
            {isLoading && (interactionMode === 'task' || interactionMode === 'computeruse') && activeConv?.taskId && (
              <button
                onClick={cancelCurrentTask}
                disabled={isCancellingTask}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-error-container text-on-error-container hover:opacity-90 transition-opacity disabled:opacity-50 flex-none"
              >
                {isCancellingTask ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <StopCircle size={12} />
                )}
                取消任务
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Model selector */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => setModelOpen(v => !v)}
                disabled={models.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-variant rounded-full text-sm text-on-surface hover:bg-outline-variant/50 transition-colors disabled:opacity-50"
              >
                <Bot size={14} />
                <span className="max-w-[180px] truncate">
                  {selectedModel?.name || (modelsLoading ? '加载中...' : (models.length === 0 ? '未选择模型' : '选择模型'))}
                </span>
                <ChevronDown size={14} className="text-on-surface-variant" />
              </button>
              {modelOpen && models.length > 0 && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-surface rounded-xl border border-outline-variant shadow-lg overflow-hidden z-20 animate-slide-down">
                  <div className="p-2 max-h-80 overflow-y-auto">
                    {models.map(model => (
                      <button
                        key={model.id}
                        onClick={() => selectModel(model.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                          selectedModel?.id === model.id
                            ? 'bg-primary-container text-on-primary-container'
                            : 'hover:bg-surface-variant text-on-surface'
                        }`}
                      >
                        <Bot size={14} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{model.name}</div>
                        </div>
                        {(model.supportsVision || model.supportsFiles || model.supportsImageGeneration) && (
                          <div className="flex gap-1">
                            {model.supportsVision && (
                              <Eye size={12} className="text-on-surface-variant" />
                            )}
                            {model.supportsFiles && (
                              <Paperclip size={12} className="text-on-surface-variant" />
                            )}
                            {model.supportsImageGeneration && (
                              <Palette size={12} className="text-tertiary" />
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 border-t border-outline-variant space-y-1">
                    <div className={`px-2 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ${
                      useLocalModels 
                        ? 'bg-tertiary-container/50 text-on-tertiary-container' 
                        : 'bg-primary-container/50 text-on-primary-container'
                    }`}>
                      <Server size={12} />
                      {useLocalModels ? '直连模式（本地配置）' : '后端代理模式'}
                    </div>
                    <button
                      onClick={async () => {
                        await fetchModels();
                        showToast({ type: 'success', title: '已刷新', description: `当前可用模型：${models.length} 个` });
                      }}
                      className="w-full flex items-center gap-2 text-xs text-on-surface hover:bg-surface-variant px-2 py-1.5 rounded-lg transition-colors"
                    >
                      <RefreshCw size={12} />
                      刷新模型列表
                    </button>
                    <button
                      onClick={() => { setModelOpen(false); navigate('/models'); }}
                      className="w-full text-left text-xs text-primary hover:underline px-2 py-1"
                    >
                      管理模型 →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeConv || activeConv.messages.length === 0 ? (
            <div key={interactionMode} className="h-full flex flex-col items-center justify-center px-8 pb-16 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center mb-5 animate-scale-in">
                <Sparkles size={26} className="text-on-primary-container" />
              </div>
              <h2 className="text-2xl font-semibold text-on-surface mb-2 animate-fade-in">
                {interactionMode === 'chat' ? '你好，我是 OxygenClaw' : interactionMode === 'task' ? '今天有什么工作要处理？' : '今天想让电脑做什么？'}
              </h2>
              <p className="text-sm text-on-surface-variant text-center max-w-md mb-8 animate-fade-in">
                {interactionMode === 'chat'
                  ? '选择一个模型，然后开始与 AI 对话。支持文件和图片上传。'
                  : interactionMode === 'task'
                  ? '描述你的目标，OxygenClaw 会自动规划并完成任务。'
                  : '描述你想要在电脑上执行的操作，AI 会自动操控鼠标和键盘完成任务。'}
              </p>

              {!imageGenMode && (
                <>
                  <div className="w-full max-w-2xl animate-slide-up">
                    <div className="bg-surface-variant rounded-2xl border border-outline-variant focus-within:border-primary transition-colors shadow-md">
                      <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        rows={3}
                        placeholder={interactionMode === 'chat' ? '输入消息...' : interactionMode === 'task' ? '描述你的任务目标...' : '描述你想要在电脑上执行的操作...'}
                        className="w-full px-4 py-3.5 bg-transparent resize-none outline-none text-sm text-on-surface placeholder-on-surface-variant border-none !border-0"
                      />
                      <div className="flex items-center justify-between px-3 pb-3">
                        <div className="flex items-center gap-0.5">
                          {capabilityModes.map(m => {
                            const Icon = m.icon;
                            const activeCap = capability === m.id;
                            return (
                              <button
                                key={m.id}
                                onClick={() => handleCapabilitySwitch(m.id)}
                                title={m.desc}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                  activeCap
                                    ? 'bg-primary-container text-on-primary-container font-medium'
                                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/60'
                                }`}
                              >
                                <Icon size={13} />
                                {m.label}
                              </button>
                            );
                          })}
                          <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileUpload} />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface/50 transition-colors"
                            title="上传文件"
                          >
                            <Paperclip size={17} />
                          </button>
                          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" multiple onChange={handleImageUpload} />
                          <button
                            onClick={() => imageInputRef.current?.click()}
                            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface/50 transition-colors"
                            title="上传图片"
                          >
                            <ImageUploadIcon size={17} />
                          </button>
                        </div>
                        <button
                          onClick={handleSend}
                          disabled={!input.trim() || isLoading}
                          className="p-2.5 bg-primary text-on-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {(interactionMode === 'chat'
                        ? ['帮我写一封周报', '总结这段文字', '头脑风暴产品名']
                        : interactionMode === 'task'
                        ? ['调研 AI Agent 市场', '写一份项目计划', '分析这份数据']
                        : ['打开记事本并输入 Hello', '整理下载文件夹', '查看系统盘剩余空间']
                      ).map(s => (
                        <button
                          key={s}
                          onClick={() => setInput(s)}
                          className="px-3 py-1.5 rounded-full border border-outline-variant text-xs text-on-surface-variant hover:text-on-surface hover:border-outline hover:bg-surface-variant/60 transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {models.length === 0 && !modelsLoading && (
                <div className="mt-8 p-4 bg-error-container/30 rounded-xl max-w-md animate-fade-in">
                  <div className="text-sm font-medium text-error flex items-center gap-2 mb-1">
                    <AlertCircle size={16} />
                    未检测到可用模型
                  </div>
                  <p className="text-xs text-on-surface-variant mb-2">
                    请先在模型管理中添加 API 提供商并启用至少一个模型
                  </p>
                  <button
                    onClick={() => navigate('/models')}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    前往模型管理 →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-6 space-y-4">
              {activeConv.messages.map((msg, msgIndex) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} message-enter`}
                  style={{ animationDelay: `${Math.min(msgIndex * 0.03, 0.3)}s` }}
                >
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-primary-container text-on-primary-container'
                  }`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-on-primary rounded-tr-md'
                          : 'bg-surface text-on-surface rounded-tl-md border border-outline-variant'
                      }`}
                    >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.attachments.filter(a => a.type === 'image').map(att => (
                            <img
                              key={att.id}
                              src={att.dataUrl}
                              alt={att.name}
                              className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => att.dataUrl && window.open(att.dataUrl, '_blank')}
                            />
                          ))}
                        </div>
                      )}
                      {msg.generatedImages && msg.generatedImages.length > 0 && (
                        <div className="mb-3">
                          <div className="grid grid-cols-2 gap-2">
                            {msg.generatedImages.map(img => (
                              <div key={img.id} className="relative group">
                                <img
                                  src={img.url}
                                  alt={img.prompt}
                                  className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(img.url, '_blank')}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadImage(img.url, `generated-${img.id}.png`);
                                      }}
                                      className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                                      title="下载图片"
                                    >
                                      <Download size={16} className="text-gray-700" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        regenerateImage(img.prompt);
                                      }}
                                      className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                                      title="重新生成"
                                    >
                                      <RefreshCw size={16} className="text-gray-700" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-on-surface-variant">
                            尺寸: {msg.generatedImages[0]?.size} | 步数: {msg.generatedImages[0]?.steps} | CFG: {msg.generatedImages[0]?.cfgScale}
                          </div>
                        </div>
                      )}
                      {msg.role === 'assistant' ? (
                        msg.content || (activeConv.agentSteps && activeConv.agentSteps.length > 0) || (activeConv.computerUseSteps && activeConv.computerUseSteps.length > 0) ? (
                          <>
                            {(interactionMode === 'task' && activeConv.agentSteps && activeConv.agentSteps.length > 0 && msg.id === activeConv.messages[activeConv.messages.length - 1]?.id) && (
                              <div className="mb-3 space-y-2">
                                {activeConv.agentSteps.map((step, idx) => {
                                  const StepIcon = getStepIcon(step.type);
                                  const StatusIcon = getStatusIcon(step.status);
                                  const isExpanded = expandedSteps.has(step.id);
                                  const expandable = canExpandStep(step);
                                  const summary = getStepSummary(step);

                                  return (
                                    <div
                                      key={step.id}
                                      className={`step-card step-${step.type} ${isExpanded ? 'expanded' : ''}`}
                                    >
                                      <div
                                        className="step-card-header"
                                        onClick={() => expandable && toggleStepExpanded(step.id)}
                                        style={{ cursor: expandable ? 'pointer' : 'default' }}
                                      >
                                        <div className="step-card-icon">
                                          <StepIcon size={16} />
                                        </div>
                                        <div className="step-card-title">
                                          <div className="step-card-title-text">
                                            {step.title || `${getStepTypeLabel(step.type)} ${idx + 1}`}
                                          </div>
                                          {summary && summary !== step.title && (
                                            <div className="step-card-summary">{summary}</div>
                                          )}
                                        </div>
                                        <div className="step-card-status">
                                          <StatusIcon
                                            size={16}
                                            className={`${getStatusClass(step.status)} ${step.status === 'running' ? 'step-status-spinner' : ''}`}
                                          />
                                          {expandable && (
                                            <ChevronDown size={16} className="step-card-expand-icon" />
                                          )}
                                        </div>
                                      </div>
                                      {expandable && (
                                        <div className="step-card-body">
                                          <div className="step-card-content">
                                            {step.toolDescription && (
                                              <div className="tool-description">
                                                {step.toolDescription}
                                              </div>
                                            )}
                                            {step.toolParams && (
                                              <>
                                                <div className="tool-param-label">请求参数</div>
                                                <div
                                                  className="tool-param-viewer"
                                                  dangerouslySetInnerHTML={{
                                                    __html: simpleHighlight(formatJson(step.toolParams), 'json')
                                                  }}
                                                />
                                              </>
                                            )}
                                            {step.toolResult && (
                                              <>
                                                <div className="tool-param-label">响应结果</div>
                                                <div
                                                  className="tool-param-viewer"
                                                  dangerouslySetInnerHTML={{
                                                    __html: simpleHighlight(
                                                      typeof step.toolResult === 'string'
                                                        ? step.toolResult
                                                        : formatJson(step.toolResult),
                                                      typeof step.toolResult === 'string' ? 'text' : 'json'
                                                    )
                                                  }}
                                                />
                                              </>
                                            )}
                                            {step.content && !step.toolParams && !step.toolResult && (
                                              <div className="step-content-text">{step.content}</div>
                                            )}
                                            {step.content && (step.toolParams || step.toolResult) && (
                                              <>
                                                <div className="tool-param-label">说明</div>
                                                <div className="step-content-text">{step.content}</div>
                                              </>
                                            )}
                                            <div className="tool-meta-info">
                                              {step.executionTime !== undefined && (
                                                <div className="tool-meta-item">
                                                  <Clock size={12} />
                                                  <span>执行时间: {step.executionTime}ms</span>
                                                </div>
                                              )}
                                              <div className="tool-meta-item">
                                                <Clock size={12} />
                                                <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {(interactionMode === 'computeruse' && activeConv.computerUseSteps && activeConv.computerUseSteps.length > 0 && msg.id === activeConv.messages[activeConv.messages.length - 1]?.id) && (
                              <div className="mb-3 space-y-2">
                                {activeConv.computerUseSteps.map((step, idx) => {
                                  const StepIcon = getStepIcon(step.type);
                                  const StatusIcon = getStatusIcon(step.status);
                                  const isExpanded = expandedSteps.has(step.id);
                                  const expandable = canExpandStep(step) || step.type === 'screenshot' || step.actionParams;
                                  const summary = getStepSummary(step);

                                  return (
                                    <div
                                      key={step.id}
                                      className={`step-card step-${step.type} ${isExpanded ? 'expanded' : ''}`}
                                    >
                                      <div
                                        className="step-card-header"
                                        onClick={() => expandable && toggleStepExpanded(step.id)}
                                        style={{ cursor: expandable ? 'pointer' : 'default' }}
                                      >
                                        <div className="step-card-icon">
                                          {step.type === 'action' && step.actionType === 'click' ? (
                                            <MousePointer size={16} />
                                          ) : step.type === 'action' && step.actionType === 'type' ? (
                                            <Keyboard size={16} />
                                          ) : step.type === 'action' && step.actionType === 'scroll' ? (
                                            <Scroll size={16} />
                                          ) : step.type === 'action' ? (
                                            <Monitor size={16} />
                                          ) : (
                                            <StepIcon size={16} />
                                          )}
                                        </div>
                                        <div className="step-card-title">
                                          <div className="step-card-title-text">
                                            {step.title || `${getStepTypeLabel(step.type)} ${idx + 1}`}
                                          </div>
                                          {summary && summary !== step.title && (
                                            <div className="step-card-summary">{summary}</div>
                                          )}
                                        </div>
                                        <div className="step-card-status">
                                          <StatusIcon
                                            size={16}
                                            className={`${getStatusClass(step.status)} ${step.status === 'running' ? 'step-status-spinner' : ''}`}
                                          />
                                          {expandable && (
                                            <ChevronDown size={16} className="step-card-expand-icon" />
                                          )}
                                        </div>
                                      </div>
                                      {expandable && (
                                        <div className="step-card-body">
                                          <div className="step-card-content">
                                            {step.actionParams && (
                                              <div className="action-params">
                                                {Object.entries(step.actionParams).map(([key, value]) => (
                                                  <div key={key} className="action-param-chip">
                                                    <span className="action-param-chip-label">{key}:</span>
                                                    <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {step.type === 'screenshot' && (
                                              <div className="computer-screenshot">
                                                {step.screenshot ? (
                                                  <img
                                                    src={step.screenshot}
                                                    alt="screenshot"
                                                    onClick={() => window.open(step.screenshot, '_blank')}
                                                  />
                                                ) : (
                                                  <div className="computer-screenshot-placeholder">
                                                    <Monitor size={32} />
                                                    <span>截图</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                            {step.content && step.type !== 'screenshot' && (
                                              <div className="step-content-text" style={{ marginTop: step.actionParams ? '10px' : '0' }}>
                                                {step.content}
                                              </div>
                                            )}
                                            <div className="tool-meta-info">
                                              {step.executionTime !== undefined && (
                                                <div className="tool-meta-item">
                                                  <Clock size={12} />
                                                  <span>执行时间: {step.executionTime}ms</span>
                                                </div>
                                              )}
                                              <div className="tool-meta-item">
                                                <Clock size={12} />
                                                <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {msg.reasoningContent && (
                              <ReasoningBlock
                                content={msg.reasoningContent}
                                startTime={msg.reasoningStartTime}
                                endTime={msg.reasoningEndTime}
                                isExpanded={expandedReasoning.has(msg.id)}
                                onToggle={() => toggleReasoningExpanded(msg.id)}
                              />
                            )}
                            {msg.content ? (
                              <MessageContent
                                content={msg.content}
                                isStreaming={isLoading && msg.id === activeConv.messages[activeConv.messages.length - 1]?.id}
                              />
                            ) : !((interactionMode === 'task' && activeConv.agentSteps && activeConv.agentSteps.length > 0) || (interactionMode === 'computeruse' && activeConv.computerUseSteps && activeConv.computerUseSteps.length > 0)) ? (
                              <TypingIndicator />
                            ) : null}
                            {msg.content && appSettings.ttsEnabled && (
                              <button
                                onClick={() => speakMessage(msg)}
                                disabled={isSynthesizing && speakingId === msg.id}
                                className="mt-2 p-1.5 rounded-lg bg-surface-variant hover:bg-outline-variant/50 transition-colors disabled:opacity-50"
                                title={speakingId === msg.id ? '停止播放' : '语音播报'}
                              >
                                {speakingId === msg.id ? (
                                  <VolumeX size={14} className="text-on-surface-variant" />
                                ) : (
                                  <Volume2 size={14} className="text-on-surface-variant" />
                                )}
                              </button>
                            )}
                          </>
                        ) : (
                          <TypingIndicator />
                        )
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {((activeConv && activeConv.messages.length > 0) || imageGenMode) && (
        <div className="border-t border-outline-variant p-4 bg-surface">
          <div className="max-w-3xl mx-auto">
            {imageGenMode && showImageGenParams && (
              <div className="mb-3 p-4 bg-surface-variant rounded-xl border border-outline-variant animate-slide-down">
                <div className="text-sm font-medium text-on-surface mb-3 flex items-center gap-2">
                  <Palette size={16} className="text-tertiary" />
                  生图参数
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                      尺寸
                    </label>
                    <select
                      value={imageGenParams.size}
                      onChange={e => setImageGenParams(p => ({ ...p, size: e.target.value }))}
                      className="w-full"
                    >
                      {IMAGE_SIZES.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                      质量
                    </label>
                    <select
                      value={imageGenParams.quality}
                      onChange={e => setImageGenParams(p => ({ ...p, quality: e.target.value }))}
                      className="w-full"
                    >
                      <option value="standard">标准</option>
                      <option value="hd">高清</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                      步数: {imageGenParams.steps}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={imageGenParams.steps}
                      onChange={e => setImageGenParams(p => ({ ...p, steps: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                      CFG Scale: {imageGenParams.cfgScale}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={imageGenParams.cfgScale}
                      onChange={e => setImageGenParams(p => ({ ...p, cfgScale: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                    负面提示词
                  </label>
                  <input
                    type="text"
                    value={imageGenParams.negativePrompt}
                    onChange={e => setImageGenParams(p => ({ ...p, negativePrompt: e.target.value }))}
                    placeholder="不希望出现在图片中的内容..."
                    className="w-full"
                  />
                </div>
              </div>
            )}

            <div className={`bg-surface-variant rounded-2xl border border-outline-variant focus-within:border-primary transition-colors ${imageGenMode ? 'focus-within:border-tertiary' : ''}`}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={imageGenMode ? '描述你想要生成的图片...' : (interactionMode === 'chat' ? '输入消息...' : interactionMode === 'task' ? '描述你的任务目标...' : '描述你想要在电脑上执行的操作...')}
                rows={2}
                className="w-full px-4 py-3 bg-transparent resize-none outline-none text-sm text-on-surface placeholder-on-surface-variant border-none !border-0"
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1 flex-wrap">
                  {!imageGenMode && (
                    <>
                      {/* 能力模式 pills（与空状态 hero 输入框一致） */}
                      {capabilityModes.map(m => {
                        const Icon = m.icon;
                        const activeCap = capability === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => handleCapabilitySwitch(m.id)}
                            title={m.desc}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors ${
                              activeCap
                                ? 'bg-primary-container text-on-primary-container font-medium'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/60'
                            }`}
                          >
                            <Icon size={12} />
                            {m.label}
                          </button>
                        );
                      })}
                      <span className="w-px h-4 bg-outline-variant mx-0.5" />
                      <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileUpload} />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface/50 transition-colors"
                        title="上传文件"
                      >
                        <Paperclip size={18} />
                      </button>
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" multiple onChange={handleImageUpload} />
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface/50 transition-colors"
                        title="上传图片"
                      >
                        <ImageUploadIcon size={18} />
                      </button>
                      {appSettings.asrEnabled && (
                        <button
                          onClick={toggleRecording}
                          className={`p-2 rounded-lg transition-colors ${
                            isRecording
                              ? 'bg-error text-on-error'
                              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
                          }`}
                          title={isRecording ? '停止录音' : '语音输入'}
                        >
                          {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                        </button>
                      )}
                    </>
                  )}
                  {imageGenMode && (
                    <button
                      onClick={() => setShowImageGenParams(v => !v)}
                      className={`p-2 rounded-lg transition-colors ${
                        showImageGenParams
                          ? 'bg-tertiary-container text-on-tertiary-container'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
                      }`}
                      title="生图参数"
                    >
                      <Settings size={18} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* 当前模型（点击打开模型选择下拉） */}
                  {!imageGenMode && (
                    <button
                      onClick={() => setModelOpen(v => !v)}
                      disabled={models.length === 0}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-on-surface-variant hover:text-on-surface hover:bg-surface/60 transition-colors disabled:opacity-40 max-w-[160px]"
                      title="选择模型"
                    >
                      <Bot size={12} className="flex-none" />
                      <span className="truncate">{selectedModel?.name || '选择模型'}</span>
                    </button>
                  )}
                  {imageGenMode ? (
                    <button
                      onClick={handleGenerateImage}
                      disabled={!input.trim() || isGeneratingImage}
                      className="p-2 bg-tertiary-container text-on-tertiary-container rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 px-4"
                    >
                      {isGeneratingImage ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Palette size={18} />
                      )}
                      <span className="text-sm font-medium">生成</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="p-2 bg-primary text-on-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant text-center mt-2">
              {imageGenMode ? '图片由 AI 生成，可能会有偏差' : 'OxygenClaw 可能会出错，请核实重要信息'}
            </p>
          </div>
        </div>
        )}
        </div>

        {/* Canvas sidebar */}
        <div 
          className={`canvas-sidebar border-l border-outline-variant bg-surface flex flex-col ${
            canvasState.isOpen ? '' : 'w-10'
          }`}
          style={canvasState.isOpen ? { width: `${sidebarWidth}px` } : undefined}
        >
          {/* Resize handle */}
          {canvasState.isOpen && (
            <div
              className={`canvas-resize-handle ${isResizing ? 'active' : ''}`}
              onMouseDown={handleResizeStart}
              onDoubleClick={handleDoubleClickResize}
              title="拖拽调整宽度 · 双击恢复默认"
            />
          )}

          {/* Canvas toggle button (collapsed state) */}
          {!canvasState.isOpen && (
            <div className="h-full flex flex-col items-center py-3">
              <button
                onClick={toggleCanvas}
                className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                title="展开 Canvas"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="mt-3 text-xs text-on-surface-variant writing-mode-vertical">
                Canvas
              </div>
            </div>
          )}

          {/* Canvas expanded content */}
          {canvasState.isOpen && (
            <>
              {/* Canvas header */}
              <div className="canvas-header">
                <div className="canvas-header-left">
                  <FileCode size={16} className="text-primary" />
                  <span className="canvas-header-title">Canvas</span>
                  {canvasState.files.length > 0 && (
                    <span className="canvas-header-count">
                      {canvasState.files.length}
                    </span>
                  )}
                </div>
                <div className="canvas-header-actions">
                  {!isFullscreen && (
                    <button
                      onClick={toggleFullscreen}
                      className="canvas-header-btn"
                      title="全屏 Canvas"
                    >
                      <Maximize2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={toggleCanvas}
                    className="canvas-header-btn"
                    title="收起 Canvas"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* File tabs */}
              {canvasState.files.length > 0 && (
                <div className="canvas-tabs">
                  {canvasState.files.map(file => (
                    <div
                      key={file.id}
                      className={`canvas-tab ${
                        canvasState.activeFileId === file.id ? 'active' : ''
                      }`}
                      onClick={() => setActiveFile(file.id)}
                    >
                      {file.type === 'markdown' ? (
                        <FileText size={14} className="canvas-tab-icon" />
                      ) : (
                        <Code size={14} className="canvas-tab-icon" />
                      )}
                      <span className="canvas-tab-title">{file.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeFile(file.id);
                        }}
                        className="canvas-tab-close"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Canvas content area */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {!activeCanvasFile ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center mb-3">
                      <FileText size={20} className="text-on-primary-container" />
                    </div>
                    <h3 className="text-sm font-medium text-on-surface mb-1">Canvas 画布</h3>
                    <p className="text-xs text-on-surface-variant mb-4">
                      上传或打开文件以在此处查看和编辑
                    </p>
                    <div className="text-xs text-on-surface-variant space-y-1">
                      <p>支持的格式：</p>
                      <p>.txt, .md, .json, .js, .ts, .py, .html, .css</p>
                    </div>
                  </div>
                ) : (
                  <div className={`canvas-editor-container canvas-editor-font-${editorFontSize}`}>
                    {/* Toolbar */}
                    <div className="canvas-toolbar">
                      <div className="canvas-toolbar-left">
                        {(activeCanvasFile.type === 'markdown' || activeCanvasFile.type === 'text') && (
                          <>
                            <button
                              onClick={() => setViewMode('edit')}
                              className={`canvas-toolbar-btn ${
                                canvasState.viewMode === 'edit' ? 'active' : ''
                              }`}
                            >
                              <Edit2 size={12} />
                              编辑
                            </button>
                            <button
                              onClick={() => setViewMode('preview')}
                              className={`canvas-toolbar-btn ${
                                canvasState.viewMode === 'preview' ? 'active' : ''
                              }`}
                            >
                              <Eye size={12} />
                              预览
                            </button>
                            <div className="canvas-toolbar-divider" />
                          </>
                        )}
                        {(activeCanvasFile.type === 'code' || activeCanvasFile.type === 'json' || activeCanvasFile.type === 'html' || activeCanvasFile.type === 'css') && (
                          <>
                            <button
                              onClick={runCode}
                              disabled={canvasState.isRunning}
                              className="canvas-toolbar-btn active"
                            >
                              {canvasState.isRunning ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Play size={12} />
                              )}
                              运行
                            </button>
                            <div className="canvas-toolbar-divider" />
                          </>
                        )}
                        <select
                          className="canvas-toolbar-select"
                          value={activeCanvasFile.language}
                          onChange={(e) => {
                            const newLang = e.target.value;
                            setCanvasState(prev => ({
                              ...prev,
                              files: prev.files.map(f =>
                                f.id === activeCanvasFile.id
                                  ? { ...f, language: newLang }
                                  : f
                              ),
                            }));
                          }}
                        >
                          <option value="text">Plain Text</option>
                          <option value="markdown">Markdown</option>
                          <option value="javascript">JavaScript</option>
                          <option value="typescript">TypeScript</option>
                          <option value="python">Python</option>
                          <option value="json">JSON</option>
                          <option value="html">HTML</option>
                          <option value="css">CSS</option>
                          <option value="java">Java</option>
                          <option value="c">C</option>
                          <option value="cpp">C++</option>
                          <option value="go">Go</option>
                          <option value="rust">Rust</option>
                          <option value="ruby">Ruby</option>
                          <option value="php">PHP</option>
                          <option value="shell">Shell</option>
                          <option value="yaml">YAML</option>
                          <option value="xml">XML</option>
                          <option value="sql">SQL</option>
                        </select>
                      </div>
                      <div className="canvas-toolbar-right">
                        <select
                          className="canvas-toolbar-select"
                          value={editorFontSize}
                          onChange={(e) => handleEditorFontSizeChange(e.target.value as 'sm' | 'md' | 'lg' | 'xl')}
                          title="字体大小"
                        >
                          <option value="sm">小</option>
                          <option value="md">中</option>
                          <option value="lg">大</option>
                          <option value="xl">特大</option>
                        </select>
                        <button
                          onClick={copyCode}
                          className="canvas-toolbar-btn"
                          title="复制代码"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={downloadFile}
                          className="canvas-toolbar-btn"
                          title="下载文件"
                        >
                          <Download size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Editor / Preview area */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      {canvasState.viewMode === 'edit' || activeCanvasFile.type !== 'markdown' ? (
                        <div className="canvas-editor-wrapper">
                          <div className="canvas-editor-gutter">
                            {activeCanvasFile.content.split('\n').map((_, i) => (
                              <div key={i} className="line-number">{i + 1}</div>
                            ))}
                          </div>
                          <div className="canvas-editor-content">
                            <textarea
                              ref={codeEditorRef}
                              value={activeCanvasFile.content}
                              onChange={(e) => updateFileContent(activeCanvasFile.id, e.target.value)}
                              className="canvas-editor-textarea"
                              spellCheck={false}
                            />
                            <pre
                              className="canvas-editor-highlight"
                              dangerouslySetInnerHTML={{
                                __html: simpleHighlight(activeCanvasFile.content + '\n', activeCanvasFile.language)
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="canvas-markdown-preview">
                          <div 
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(activeCanvasFile.content) }}
                          />
                        </div>
                      )}

                      {/* Output panel */}
                      {canvasState.output && (
                        <div className="canvas-output-panel">
                          <div className="canvas-output-header">
                            <span className="canvas-output-title">输出</span>
                            <button
                              onClick={() => setCanvasState(prev => ({ ...prev, output: '' }))}
                              className="canvas-output-close"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="canvas-output-content">
                            {canvasState.output}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  html = html.replace(/\n/g, '<br>');
  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} 分 ${remainingSeconds} 秒`;
}

const TypingIndicator: React.FC = () => {
  return (
    <div className="typing-indicator">
      <div className="typing-dots-container">
        <div className="typing-dot animate-bounce-dot" />
        <div className="typing-dot animate-bounce-dot animate-bounce-dot-delay-1" />
        <div className="typing-dot animate-bounce-dot animate-bounce-dot-delay-2" />
      </div>
      <span className="typing-indicator-text">思考中...</span>
    </div>
  );
};

interface ReasoningBlockProps {
  content: string;
  startTime?: number;
  endTime?: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const ReasoningBlock: React.FC<ReasoningBlockProps> = ({ content, startTime, endTime, isExpanded, onToggle }) => {
  const duration = startTime ? formatDuration((endTime || Date.now()) - startTime) : '';
  
  return (
    <div className="reasoning-section">
      <div className="reasoning-header" onClick={onToggle}>
        <div className="reasoning-header-left">
          <Brain size={14} className="reasoning-icon" />
          <span className="reasoning-title">思考过程</span>
          {duration && <span className="reasoning-time">已思考 {duration}</span>}
          {!endTime && startTime && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow" />
          )}
        </div>
        <ChevronDown size={14} className={`reasoning-chevron ${isExpanded ? 'open' : ''}`} />
      </div>
      <div className={`reasoning-content ${!isExpanded ? 'collapsed' : ''}`}>
        {content}
      </div>
    </div>
  );
};

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ content, isStreaming }) => {
  return (
    <div className="markdown-body">
      <span dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
      {isStreaming && <span className="typing-cursor animate-typing-cursor" />}
    </div>
  );
};

export default Playgrounds;
