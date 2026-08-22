export interface ModelProvider {
  id: string;
  name: string;
  type: 'openai-compatible' | 'anthropic' | 'google' | 'azure' | 'custom';
  apiKey: string;
  baseUrl: string;
  models: ModelInfo[];
  billingMultiplier?: number;
  createdAt: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  enabled: boolean;
  supportsVision?: boolean;
  supportsFiles?: boolean;
  supportsImageGeneration?: boolean;
  contextWindow?: number;
  maxOutput?: number;
}

const KEY = 'oxygenclaw:providers';

export function loadProviders(): ModelProvider[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ModelProvider[];
  } catch {
    return [];
  }
}

export function saveProviders(providers: ModelProvider[]): void {
  localStorage.setItem(KEY, JSON.stringify(providers));
}

export function getEnabledModels(providers: ModelProvider[]): ModelInfo[] {
  const models: ModelInfo[] = [];
  for (const p of providers) {
    for (const m of p.models) {
      if (m.enabled) {
        models.push({
          ...m,
          id: `${p.id}:${m.id}`,
          name: m.name || m.id,
        });
      }
    }
  }
  return models;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface Conversation {
  id: string;
  title: string;
  mode: 'chat' | 'task';
  capability: 'fast' | 'think' | 'expert' | 'research' | 'moa';
  modelId: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  reasoningContent?: string;
  reasoningStartTime?: number;
  reasoningEndTime?: number;
  generatedImages?: GeneratedImage[];
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  dataUrl?: string;
}

const CONV_KEY = 'oxygenclaw:conversations';

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

export function saveConversations(convs: Conversation[]): void {
  localStorage.setItem(CONV_KEY, JSON.stringify(convs));
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultModel: string;
  defaultMode: 'chat' | 'task';
  defaultCapability: 'fast' | 'think' | 'expert' | 'research' | 'moa';
  workspaceDir: string;
  autoStart: boolean;
  disableGpuAccel: boolean;
  hotkey: string;
  dataSourceUrl: string;
  dataSourceEnabled: boolean;
  visionEnabled: boolean;
  visionApiKey: string;
  visionBaseUrl: string;
  visionModel: string;
  asrEnabled: boolean;
  asrApiKey: string;
  asrBaseUrl: string;
  asrModel: string;
  ttsEnabled: boolean;
  ttsApiKey: string;
  ttsBaseUrl: string;
  ttsModel: string;
  ttsVoice: string;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  imageGenEnabled: boolean;
  imageGenApiKey: string;
  imageGenBaseUrl: string;
  imageGenModel: string;
  imageGenDefaultSize: string;
  imageGenDefaultSteps: number;
  imageGenDefaultCfgScale: number;
  imageGenDefaultQuality: string;
  directModelAccess: boolean;
  dashboardApiUseProxy?: boolean;
}

const SETTINGS_KEY = 'oxygenclaw:settings';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  defaultModel: '',
  defaultMode: 'chat',
  defaultCapability: 'fast',
  workspaceDir: '',
  autoStart: false,
  disableGpuAccel: false,
  hotkey: 'Ctrl+F12',
  dataSourceUrl: '',
  dataSourceEnabled: false,
  visionEnabled: false,
  visionApiKey: '',
  visionBaseUrl: 'https://api.stepfun.com/step_plan/v1',
  visionModel: 'step-3.7-flash',
  asrEnabled: false,
  asrApiKey: '',
  asrBaseUrl: 'https://api.stepfun.com/step_plan/v1',
  asrModel: 'stepaudio-2.5-asr',
  ttsEnabled: false,
  ttsApiKey: '',
  ttsBaseUrl: 'https://api.stepfun.com/step_plan/v1',
  ttsModel: 'stepaudio-2.5-tts',
  ttsVoice: '',
  voiceInputEnabled: false,
  voiceOutputEnabled: false,
  imageGenEnabled: false,
  imageGenApiKey: '',
  imageGenBaseUrl: 'https://api.stepfun.com/step_plan/v1',
  imageGenModel: 'step-image-2k',
  imageGenDefaultSize: '1024x1024',
  imageGenDefaultSteps: 20,
  imageGenDefaultCfgScale: 7.5,
  imageGenDefaultQuality: 'standard',
  directModelAccess: false,
  dashboardApiUseProxy: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface UserAccount {
  email: string;
  username: string;
  oxygenId: string;
  createdAt: number;
}

const USER_KEY = 'oxygenclaw:user';

export function loadUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserAccount;
  } catch {
    return null;
  }
}

export function saveUser(user: UserAccount | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}
