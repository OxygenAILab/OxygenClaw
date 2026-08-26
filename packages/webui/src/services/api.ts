import { loadProviders, loadSettings, ModelProvider } from '../store';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'oxygenclaw:token';

function parseModelId(fullModelId: string): { providerId: string; modelId: string } {
  const parts = fullModelId.split(':');
  if (parts.length >= 2) {
    return { providerId: parts[0], modelId: parts.slice(1).join(':') };
  }
  return { providerId: '', modelId: fullModelId };
}

function getProviderById(providerId: string): ModelProvider | null {
  const providers = loadProviders();
  return providers.find(p => p.id === providerId) || null;
}

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  if (!url.endsWith('/v1') && !url.includes('/v1/')) {
    url = url + '/v1';
  }
  return url;
}

async function directRequest<T = any>(
  baseUrl: string,
  apiKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${endpoint}`, {
      ...options,
      headers,
    });

    let data: any;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (error: any) {
    let errorMsg = error.message || 'Network error';
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('CORS')) {
      errorMsg = '网络请求失败，可能是 CORS 限制或网络问题。请检查 API 地址是否正确，或使用后端代理模式。';
    }
    return { success: false, error: errorMsg };
  }
}

async function directRequestStream(
  baseUrl: string,
  apiKey: string,
  endpoint: string,
  body: any,
  onMessage: (chunk: string, data: any) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'text/event-stream',
    };

    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errorMsg = errData?.error?.message || errData?.error || errData?.message || errorMsg;
      } catch {}
      onError?.(errorMsg);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.('No response body');
      return;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let completed = false;

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') {
          if (!completed) {
            completed = true;
            onComplete?.();
          }
          return;
        }
        try {
          const data = JSON.parse(dataStr);
          onMessage(dataStr, data);
        } catch {
          onMessage(dataStr, { content: dataStr });
        }
      } else if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') {
          if (!completed) {
            completed = true;
            onComplete?.();
          }
          return;
        }
        try {
          const data = JSON.parse(dataStr);
          onMessage(dataStr, data);
        } catch {
          onMessage(dataStr, { content: dataStr });
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      let lineEndIndex;
      while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEndIndex);
        buffer = buffer.slice(lineEndIndex + 1);
        processLine(line);
      }
      
      if (buffer.includes('\r')) {
        while ((lineEndIndex = buffer.indexOf('\r')) !== -1) {
          const line = buffer.slice(0, lineEndIndex);
          buffer = buffer.slice(lineEndIndex + 1);
          processLine(line);
        }
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }

    if (!completed) {
      completed = true;
      onComplete?.();
    }
  } catch (error: any) {
    let errorMsg = error.message || 'Network error';
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('CORS') || errorMsg.includes('cross-origin')) {
      errorMsg = '网络请求失败，可能是 CORS 跨域限制。请检查 API 地址是否正确，或使用后端代理模式。';
    }
    onError?.(errorMsg);
  }
}

export const directLlmApi = {
  directChatCompletions: async (
    providerId: string,
    modelId: string,
    messages: ChatMessage[],
    options: Partial<ChatCompletionRequest> = {}
  ) => {
    const provider = getProviderById(providerId);
    if (!provider) {
      return { success: false, error: `Provider not found: ${providerId}` };
    }
    return directRequest<ChatCompletionResponse>(
      provider.baseUrl,
      provider.apiKey,
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          model: modelId,
          messages,
          ...options,
          stream: false,
        }),
      }
    );
  },

  directChatCompletionsStream: (
    providerId: string,
    modelId: string,
    messages: ChatMessage[],
    options: Partial<ChatCompletionRequest> = {},
    callbacks: {
      onMessage: (chunk: string, data: any) => void;
      onComplete?: () => void;
      onError?: (error: string) => void;
    }
  ) => {
    const provider = getProviderById(providerId);
    if (!provider) {
      callbacks.onError?.(`Provider not found: ${providerId}`);
      return;
    }
    directRequestStream(
      provider.baseUrl,
      provider.apiKey,
      '/chat/completions',
      {
        model: modelId,
        messages,
        ...options,
        stream: true,
      },
      callbacks.onMessage,
      callbacks.onComplete,
      callbacks.onError
    );
  },

  directGenerateImage: async (
    providerId: string,
    modelId: string,
    prompt: string,
    options: Partial<ImageGenerationRequest> = {}
  ) => {
    const provider = getProviderById(providerId);
    if (!provider) {
      return { success: false, error: `Provider not found: ${providerId}` };
    }
    return directRequest<ImageGenerationResponse>(
      provider.baseUrl,
      provider.apiKey,
      '/images/generations',
      {
        method: 'POST',
        body: JSON.stringify({
          model: modelId,
          prompt,
          ...options,
        }),
      }
    );
  },

  parseModelId,
  getProviderById,
};

export interface User {
  id: string;
  email: string;
  username: string;
  oxygenId?: string;
  createdAt?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  maxTokens?: number;
  contextWindow?: number;
  supportsVision?: boolean;
  supportsFiles?: boolean;
  supportsTools?: boolean;
  supportsImageGeneration?: boolean;
  costPer1KInput?: number;
  costPer1KOutput?: number;
}

export interface ChatMessageContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: string };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ChatMessageContentPart[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  size?: string;
  steps?: number;
  cfg_scale?: number;
  quality?: string;
  n?: number;
  negative_prompt?: string;
  seed?: number;
}

export interface ImageGenerationResponse {
  created: number;
  data: {
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }[];
}

export interface AgentExecuteRequest {
  prompt: string;
  mode?: 'chat' | 'task';
  capability?: 'fast' | 'think' | 'expert' | 'research' | 'moa';
  modelId?: string;
}

export interface ComputerUseExecuteRequest {
  task: string;
  modelId?: string;
}

export interface AgentTask {
  id: string;
  prompt?: string;
  task?: string;
  mode?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
  steps?: any[];
  result?: string;
  error?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: any[];
}

export interface Conversation {
  id: string;
  title: string;
  mode?: string;
  capability?: string;
  modelId?: string;
  createdAt: string;
  updatedAt: string;
  messages?: ConversationMessage[];
  metadata?: Record<string, any>;
}

export interface SuggestionPrompt {
  title: string;
  prompt: string;
  category: string;
  icon?: string;
}

export interface AppSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: 'zh' | 'en';
  fontSize?: 'small' | 'normal' | 'large' | 'xlarge';
  defaultModel?: string;
  defaultMode?: 'chat' | 'task';
  defaultCapability?: 'fast' | 'think' | 'expert' | 'research' | 'moa';
  temperature?: number;
  maxTokens?: number;
  notificationsEnabled?: boolean;
  soundEnabled?: boolean;
  taskRemindersEnabled?: boolean;
  workspaceDir?: string;
  autoStart?: boolean;
  disableGpuAccel?: boolean;
  hotkey?: string;
  dataSourceUrl?: string;
  dataSourceEnabled?: boolean;
  visionEnabled?: boolean;
  visionApiKey?: string;
  visionBaseUrl?: string;
  visionModel?: string;
  asrEnabled?: boolean;
  asrApiKey?: string;
  asrBaseUrl?: string;
  asrModel?: string;
  ttsEnabled?: boolean;
  ttsApiKey?: string;
  ttsBaseUrl?: string;
  ttsModel?: string;
  ttsVoice?: string;
  voiceInputEnabled?: boolean;
  voiceOutputEnabled?: boolean;
  imageGenEnabled?: boolean;
  imageGenApiKey?: string;
  imageGenBaseUrl?: string;
  imageGenModel?: string;
  imageGenDefaultSize?: string;
  imageGenDefaultSteps?: number;
  imageGenDefaultCfgScale?: number;
  imageGenDefaultQuality?: string;
  dashboardApiEnabled?: boolean;
  dashboardApiUrl?: string;
  dashboardApiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  dashboardApiAuthType?: 'none' | 'bearer' | 'apikey' | 'custom' | 'newapi';
  dashboardApiAuthToken?: string;
  dashboardApiAuthHeader?: string;
  dashboardApiHeaders?: string;
  dashboardApiBody?: string;
  dashboardApiVariables?: Record<string, string>;
  directModelAccess?: boolean;
  dashboardApiUseProxy?: boolean;
  [key: string]: any;
}

export interface DashboardStats {
  totalRequests?: number;
  totalTokens?: number;
  balance?: number;
  todayCost?: number;
  monthCost?: number;
  avgRpm?: number;
  avgTpm?: number;
  peakTps?: number;
  peakConcurrency?: number;
  successCount?: number;
  failedCount?: number;
  modelStats?: { model: string; requests: number; cost: number }[];
  dailyStats?: { date: string; requests: number; cost: number }[];
  [key: string]: any;
}

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  category?: string;
  tags?: string[];
  downloads?: number;
  rating?: number;
  createdAt?: string;
  updatedAt?: string;
  icon?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    let result: ApiResponse<T>;
    try {
      result = await response.json();
    } catch {
      result = {
        success: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    }

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || result.message || `HTTP ${response.status}`,
      };
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function requestStream(
  endpoint: string,
  body: any,
  onMessage: (chunk: string, data: any) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errorMsg = errData.error || errData.message || errorMsg;
      } catch {}
      onError?.(errorMsg);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.('No response body');
      return;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let completed = false;

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') {
          if (!completed) {
            completed = true;
            onComplete?.();
          }
          return;
        }
        try {
          const data = JSON.parse(dataStr);
          onMessage(dataStr, data);
        } catch {
          onMessage(dataStr, { content: dataStr });
        }
      } else if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') {
          if (!completed) {
            completed = true;
            onComplete?.();
          }
          return;
        }
        try {
          const data = JSON.parse(dataStr);
          onMessage(dataStr, data);
        } catch {
          onMessage(dataStr, { content: dataStr });
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      let lineEndIndex;
      while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEndIndex);
        buffer = buffer.slice(lineEndIndex + 1);
        processLine(line);
      }
      
      if (buffer.includes('\r')) {
        while ((lineEndIndex = buffer.indexOf('\r')) !== -1) {
          const line = buffer.slice(0, lineEndIndex);
          buffer = buffer.slice(lineEndIndex + 1);
          processLine(line);
        }
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }

    if (!completed) {
      completed = true;
      onComplete?.();
    }
  } catch (error) {
    onError?.(error instanceof Error ? error.message : 'Network error');
  }
}

export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { emailOrUsername: string; password: string }) =>
    request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<User>('/auth/me'),

  setToken,
  getToken,
};

export interface ProviderModel {
  id: string;
  name: string;
  displayName?: string;
  enabled: boolean;
  supportsVision?: boolean;
  supportsFiles?: boolean;
  supportsTools?: boolean;
  contextWindow?: number;
  maxOutput?: number;
  costPer1KInput?: number;
  costPer1KOutput?: number;
  createdAt?: number;
}

export interface ModelProviderData {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  baseUrl: string;
  billingMultiplier?: number;
  createdAt: number;
  updatedAt: number;
  models: ProviderModel[];
}

export const llmApi = {
  getModels: () =>
    request<{ models: ModelInfo[] }>('/llm/models'),

  getProviders: () =>
    request<{ providers: ModelProviderData[] }>('/llm/providers'),

  createProvider: (data: {
    name: string;
    type: string;
    apiKey: string;
    baseUrl: string;
    models?: ProviderModel[];
    billingMultiplier?: number;
  }) =>
    request<ModelProviderData>('/llm/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProvider: (id: string, data: {
    name?: string;
    type?: string;
    apiKey?: string;
    baseUrl?: string;
    models?: ProviderModel[];
    billingMultiplier?: number;
  }) =>
    request<ModelProviderData>(`/llm/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProvider: (id: string) =>
    request<void>(`/llm/providers/${id}`, {
      method: 'DELETE',
    }),

  toggleModel: (modelId: string) =>
    request<ProviderModel>(`/llm/models/${modelId}/toggle`, {
      method: 'POST',
    }),

  testProvider: (id: string) =>
    request<{ message: string; response?: string }>(`/llm/providers/${id}/test`, {
      method: 'POST',
    }),

  chatCompletions: (data: ChatCompletionRequest) =>
    request<ChatCompletionResponse>('/llm/chat/completions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  chatCompletionsStream: (
    data: ChatCompletionRequest,
    onMessage: (chunk: string, data: any) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ) => {
    const settings = loadSettings();
    const triedDirect = { value: false };

    const tryDirectFallback = (errorMsg: string) => {
      if (triedDirect.value) {
        onError?.(errorMsg);
        return;
      }
      triedDirect.value = true;

      const providers = loadProviders();
      if (providers.length === 0) {
        onError?.(errorMsg);
        return;
      }

      const { providerId, modelId } = parseModelId(data.model);
      const provider = providers.find(p => p.id === providerId);
      
      if (!provider || !provider.apiKey || !provider.baseUrl) {
        onError?.(errorMsg);
        return;
      }

      console.warn('[LLM] Backend API failed, trying direct model access:', errorMsg);
      
      directLlmApi.directChatCompletionsStream(
        providerId,
        modelId,
        data.messages,
        {
          temperature: data.temperature,
          maxTokens: data.maxTokens,
        },
        {
          onMessage,
          onComplete,
          onError: (directError) => {
            onError?.(`后端接口失败，直连也失败: ${directError}`);
          }
        }
      );
    };

    if (settings.directModelAccess) {
      const providers = loadProviders();
      if (providers.length > 0) {
        const { providerId, modelId } = parseModelId(data.model);
        const provider = providers.find(p => p.id === providerId);
        if (provider && provider.apiKey && provider.baseUrl) {
          triedDirect.value = true;
          directLlmApi.directChatCompletionsStream(
            providerId,
            modelId,
            data.messages,
            {
              temperature: data.temperature,
              maxTokens: data.maxTokens,
            },
            {
              onMessage,
              onComplete,
              onError: (directError) => {
                console.warn('[LLM] Direct access failed, trying backend API:', directError);
                requestStream('/llm/chat/completions', { ...data, stream: true }, onMessage, onComplete, (backendError) => {
                  onError?.(`直连和后端接口都失败: ${directError} / ${backendError}`);
                });
              }
            }
          );
          return;
        }
      }
    }

    requestStream('/llm/chat/completions', { ...data, stream: true }, onMessage, onComplete, (error) => {
      if (settings.directModelAccess) {
        tryDirectFallback(error);
      } else {
        onError?.(error);
      }
    });
  },

  generateImage: (data: ImageGenerationRequest) =>
    request<ImageGenerationResponse>('/llm/image/generations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const agentApi = {
  execute: (
    data: AgentExecuteRequest & { onMessage?: (data: any) => void },
    onMessage?: (chunk: string, data: any) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ) => {
    const messageCallback = data.onMessage 
      ? (_chunk: string, d: any) => data.onMessage!(d)
      : onMessage;
    
    const requestData = { ...data };
    delete requestData.onMessage;
    
    if (messageCallback) {
      return requestStream('/agent/execute', requestData, messageCallback, onComplete, onError);
    }
    return request<any>('/agent/execute', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  executeComputerUse: (
    data: ComputerUseExecuteRequest & { onMessage?: (data: any) => void },
    onMessage?: (chunk: string, data: any) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ) => {
    const messageCallback = data.onMessage 
      ? (_chunk: string, d: any) => data.onMessage!(d)
      : onMessage;
    
    const requestData = { ...data };
    delete requestData.onMessage;
    
    if (messageCallback) {
      return requestStream('/agent/computeruse/execute', requestData, messageCallback, onComplete, onError);
    }
    return request<any>('/agent/computeruse/execute', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  computerUseExecute: (
    data: ComputerUseExecuteRequest,
    onMessage?: (chunk: string, data: any) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ) => agentApi.executeComputerUse(data, onMessage, onComplete, onError),

  getTasks: () =>
    request<AgentTask[]>('/agent/tasks'),

  getTask: (id: string) =>
    request<AgentTask>(`/agent/tasks/${id}`),

  cancelTask: (id: string) =>
    request<AgentTask>(`/agent/tasks/${id}/cancel`, {
      method: 'POST',
    }),
};

export const conversationApi = {
  list: (mode?: string) =>
    request<Conversation[]>(`/conversations${mode ? `?mode=${mode}` : ''}`),

  create: (params: { title?: string; modelId: string; mode?: string; capability?: string }) =>
    request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  get: (id: string) =>
    request<Conversation>(`/conversations/${id}`),

  sendMessage: (
    id: string,
    params: { content: string; modelId?: string; onMessage?: (data: any) => void; onComplete?: () => void; onError?: (error: string) => void }
  ) => {
    const onMessage = params.onMessage;
    const onComplete = params.onComplete;
    const onError = params.onError;
    const requestData = { content: params.content, modelId: params.modelId };
    
    if (onMessage) {
      return requestStream(
        `/conversations/${id}/messages`,
        requestData,
        (_chunk, data) => onMessage(data),
        onComplete,
        onError
      );
    }
    return request<any>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  editMessage: (
    id: string,
    messageId: string,
    params: { content: string; onMessage?: (data: any) => void; onComplete?: () => void; onError?: (error: string) => void }
  ) => {
    const { onMessage, onComplete, onError, ...requestData } = params;
    if (onMessage) {
      return requestStream(
        `/conversations/${id}/messages/${messageId}/edit`,
        requestData,
        (_chunk, data) => onMessage(data),
        onComplete,
        onError
      );
    }
    return request<any>(`/conversations/${id}/messages/${messageId}/edit`, {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  regenerate: (
    id: string,
    callbacks?: { onMessage?: (data: any) => void; onComplete?: () => void; onError?: (error: string) => void }
  ) => {
    if (callbacks?.onMessage) {
      return requestStream(
        `/conversations/${id}/regenerate`,
        {},
        (_chunk, data) => callbacks.onMessage!(data),
        callbacks.onComplete,
        callbacks.onError
      );
    }
    return request<any>(`/conversations/${id}/regenerate`, {
      method: 'POST',
    });
  },

  generateTitle: (id: string) =>
    request<{ title: string }>(`/conversations/${id}/generate-title`, {
      method: 'POST',
    }),

  search: (query: string, mode?: string) =>
    request<{ conversations: Conversation[]; total: number }>(
      `/conversations/search?q=${encodeURIComponent(query)}${mode ? `&mode=${mode}` : ''}`
    ),

  getSuggestions: (mode?: string) =>
    request<{ suggestions: SuggestionPrompt[]; total: number }>(
      `/conversations/suggestions/prompts${mode ? `?mode=${mode}` : ''}`
    ),

  sendFeedback: (id: string, messageId: string, type: 'like' | 'dislike', reason?: string) =>
    request(`/conversations/${id}/messages/${messageId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ type, reason }),
    }),

  update: (id: string, params: any) =>
    request<Conversation>(`/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    }),

  remove: (id: string) =>
    request<void>(`/conversations/${id}`, {
      method: 'DELETE',
    }),

  clear: () =>
    request<void>('/conversations', {
      method: 'DELETE',
    }),
};

export const settingsApi = {
  get: () =>
    request<AppSettings>('/settings'),

  update: (settings: AppSettings) =>
    request<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

export function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

function parseHeaders(headersJson: string, variables: Record<string, string>): Record<string, string> {
  try {
    const parsed = JSON.parse(headersJson);
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = replaceVariables(String(value), variables);
    }
    return result;
  } catch {
    return {};
  }
}

export const dashboardApi = {
  getStats: () =>
    request<DashboardStats>('/dashboard/stats'),

  getCustomStats: async (
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    authType: string = 'none',
    authToken: string = '',
    authHeader?: string,
    customHeaders?: string,
    body?: string,
    variables?: Record<string, string>
  ) => {
    const vars = variables || {};
    const resolvedUrl = replaceVariables(url, vars);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authType === 'bearer') {
      headers['Authorization'] = `Bearer ${replaceVariables(authToken, vars)}`;
    } else if (authType === 'apikey') {
      headers['X-API-Key'] = replaceVariables(authToken, vars);
    } else if (authType === 'custom' && authHeader) {
      headers[authHeader] = replaceVariables(authToken, vars);
    }

    if (customHeaders) {
      const parsedCustomHeaders = parseHeaders(customHeaders, vars);
      Object.assign(headers, parsedCustomHeaders);
    }

    const options: RequestInit = {
      method: method || 'GET',
      headers,
    };

    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && body) {
      options.body = replaceVariables(body, vars);
    }

    try {
      const res = await fetch(resolvedUrl, options);
      
      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
        let errorType = 'http';
        
        try {
          const errData = await res.json();
          errorMsg = errData?.error?.message || errData?.error || errData?.message || errorMsg;
        } catch {}
        
        if (res.status === 401 || res.status === 403) {
          errorType = 'auth';
          errorMsg = `认证失败 (${res.status}): ${errorMsg}`;
        }
        
        return { success: false, data: null, error: errorMsg, errorType };
      }
      
      const data = await res.json();
      return { success: true, data, error: null };
    } catch (err: any) {
      let errorMsg = err.message || '请求失败';
      let errorType = 'network';
      
      const lowerMsg = errorMsg.toLowerCase();
      if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('cors') || lowerMsg.includes('cross-origin')) {
        errorType = 'cors';
        errorMsg = '请求失败：可能是 CORS 跨域限制。浏览器无法直接请求第三方 API，建议通过后端代理转发请求。';
      } else if (lowerMsg.includes('networkerror') || lowerMsg.includes('network error') || lowerMsg.includes('net::')) {
        errorType = 'network';
        errorMsg = '网络错误：无法连接到服务器，请检查 URL 是否正确或网络是否正常。';
      } else if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out')) {
        errorType = 'timeout';
        errorMsg = '请求超时：服务器响应时间过长，请稍后重试。';
      }
      
      return { success: false, data: null, error: errorMsg, errorType };
    }
  },
};

export const marketplaceApi = {
  getSkills: () =>
    request<MarketplaceSkill[]>('/marketplace/skills'),

  getSkill: (id: string) =>
    request<MarketplaceSkill>(`/marketplace/skills/${id}`),
};

export interface ProxyRequestParams {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ProxyResponseData {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export const proxyApi = {
  request: async (params: ProxyRequestParams): Promise<{
    success: boolean;
    data?: ProxyResponseData;
    error?: string;
  }> => {
    try {
      const result = await request<ProxyResponseData>('/proxy/request', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Proxy request failed',
      };
    }
  },
};

export interface CliCheckResult {
  installed: boolean;
  version?: string;
}

export interface CliExecResult {
  command: string;
  stdout: string;
  stderr: string;
  output: string;
}

export interface CliSkillInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled?: boolean;
  installedAt?: string;
}

export const cliApi = {
  check: async (): Promise<{ success: boolean; data?: CliCheckResult; error?: string }> => {
    try {
      const result = await request<CliCheckResult>('/cli/check');
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to check CLI',
      };
    }
  },

  install: (
    onMessage?: (chunk: string, data: any) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    return new Promise((resolve) => {
      requestStream(
        '/cli/install',
        {},
        (chunk, data) => {
          onMessage?.(chunk, data);
          if (data?.type === 'done') {
            if (data.success) {
              onComplete?.();
            } else {
              onError?.(data.error || 'Installation failed');
            }
            resolve();
          }
        },
        () => {
          onComplete?.();
          resolve();
        },
        (error) => {
          onError?.(error);
          resolve();
        }
      );
    });
  },

  exec: async (command: string, args?: string[]): Promise<{
    success: boolean;
    data?: CliExecResult;
    error?: string;
  }> => {
    try {
      const result = await request<CliExecResult>('/cli/exec', {
        method: 'POST',
        body: JSON.stringify({ command, args: args || [] }),
      });
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Command execution failed',
      };
    }
  },

  listSkills: async (): Promise<{
    success: boolean;
    data?: { skills: CliSkillInfo[]; count: number };
    error?: string;
  }> => {
    try {
      const result = await request<{ skills: CliSkillInfo[]; count: number }>('/cli/skills');
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to list skills',
      };
    }
  },
};

export const multimodalApi = {
  analyzeImage: (imageBase64: string, prompt: string, options?: any) =>
    request<{ content: string; usage: any }>('/multimodal/analyze-image', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, prompt, options }),
    }),

  analyzeVideo: (videoData: { type: string; data: string }, prompt: string) =>
    request<{ content: string; usage: any }>('/multimodal/analyze-video', {
      method: 'POST',
      body: JSON.stringify({ videoData, prompt }),
    }),

  transcribeAudio: (audioBase64: string, format?: string) =>
    request<{ text: string }>('/multimodal/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, format }),
    }),

  synthesizeSpeech: (text: string, voice?: string) =>
    request<{ audioBase64: string; format: string }>('/multimodal/synthesize', {
      method: 'POST',
      body: JSON.stringify({ text, voice }),
    }),
};

export const apiClient = {
  auth: authApi,
  llm: llmApi,
  agent: agentApi,
  conversation: conversationApi,
  settings: settingsApi,
  dashboard: dashboardApi,
  marketplace: marketplaceApi,
  multimodal: multimodalApi,
  proxy: proxyApi,
  cli: cliApi,
  setToken,
  getToken,
};

export default apiClient;
