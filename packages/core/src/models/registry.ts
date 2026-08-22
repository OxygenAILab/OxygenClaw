import { v4 as uuidv4 } from 'uuid';
import { 
  ModelConfig, 
  ModelProvider, 
  ModelRegistry as IModelRegistry,
  ModelSwitchOptions,
  ModelGroup,
  ModelSwitchEvent
} from '../types';

export const STANDARD_MODEL_NAMES: Record<string, string[]> = {
  'gpt-4o': ['gpt-4o', 'gpt4o', 'gpt-4', 'gpt4', 'openai-gpt-4o'],
  'gpt-4-turbo': ['gpt-4-turbo', 'gpt4-turbo', 'gpt-4-turbo-preview', 'gpt4-turbo-preview'],
  'gpt-4': ['gpt-4', 'gpt4', 'gpt-4-0314'],
  'gpt-3.5-turbo': ['gpt-3.5-turbo', 'gpt-3.5', 'gpt35', 'gpt-3.5-turbo-16k'],
  
  'claude-3.5-sonnet': ['claude-3-5-sonnet', 'claude-3.5-sonnet', 'claude-3.5-sonnet-20240620', 'claude-3-5-sonnet-20240620'],
  'claude-3-opus': ['claude-3-opus', 'claude-3-opus-20240229', 'claude-opus'],
  'claude-3-sonnet': ['claude-3-sonnet', 'claude-3-sonnet-20240229', 'claude-sonnet'],
  'claude-3-haiku': ['claude-3-haiku', 'claude-3-haiku-20240307', 'claude-haiku'],
  'claude-2.1': ['claude-2.1', 'claude-2-1', 'claude-2'],
  
  'gemini-2.5-pro': ['gemini-2.5-pro', 'gemini-2.5-pro-exp', 'gemini-pro-2.5'],
  'gemini-2.5-flash': ['gemini-2.5-flash', 'gemini-2.5-flash-exp', 'gemini-flash-2.5'],
  'gemini-1.5-pro': ['gemini-1.5-pro', 'gemini-1.5-pro-latest', 'gemini-pro'],
  'gemini-1.5-flash': ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-flash'],
  
  'step-3.5-flash': ['step-3.5-flash', 'step-3.5-flash-202503', 'step-3.5'],
  'step-2-16k': ['step-2-16k', 'step-2', 'stepfun-2'],
  
  'deepseek-v3': ['deepseek-v3', 'deepseek-v3-2025', 'deepseek-3'],
  'deepseek-r1': ['deepseek-r1', 'deepseek-reasoner', 'deepseek-reasoning'],
  'deepseek-chat': ['deepseek-chat', 'deepseek-v2', 'deepseek-2'],
  
  'qwen-2.5-72b': ['qwen-2.5-72b', 'qwen-2.5-72b-instruct', 'qwen2.5-72b', 'qwen2-72b'],
  'qwen-2.5-7b': ['qwen-2.5-7b', 'qwen-2.5-7b-instruct', 'qwen2.5-7b'],
  'qwen-turbo': ['qwen-turbo', 'qwen-max-turbo', 'qwen-turbo-latest'],
  'qwen-plus': ['qwen-plus', 'qwen-max-plus', 'qwen-plus-latest'],
  
  'llama-3.1-405b': ['llama-3.1-405b', 'llama-3.1-405b-instruct', 'llama3.1-405b', 'llama3-405b'],
  'llama-3.1-70b': ['llama-3.1-70b', 'llama-3.1-70b-instruct', 'llama3.1-70b'],
  'llama-3.1-8b': ['llama-3.1-8b', 'llama-3.1-8b-instruct', 'llama3.1-8b'],
  'llama-3': ['llama-3', 'llama-3-8b', 'llama-3-70b', 'llama3'],
  
  'mistral-large': ['mistral-large', 'mistral-large-latest', 'mistral-large-2407'],
  'mistral-medium': ['mistral-medium', 'mistral-medium-2312'],
  'mistral-small': ['mistral-small', 'mistral-small-latest'],
  'mistral-tiny': ['mistral-tiny', 'mistral-tiny-latest'],
  'codestral': ['codestral', 'codestral-latest'],
  
  'yi-1.5-34b': ['yi-1.5-34b', 'yi-1.5-34b-chat', 'yi-34b', 'yi-large'],
  'moonshot-v1': ['moonshot-v1', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  'glm-4': ['glm-4', 'glm-4-9b', 'zhipu-glm-4'],
  'ernie-bot': ['ernie-bot', 'ernie-bot-4', 'ernie-bot-turbo', 'wenxin'],
  
  'doubao-3': ['doubao-3', 'doubao-3-pro', 'doubao-pro'],
};

export const MODEL_ICONS: Record<string, string> = {
  'openai': '🤖',
  'gpt': '🤖',
  'anthropic': '🔵',
  'claude': '🔵',
  'google': '🌈',
  'gemini': '🌈',
  'stepfun': '⚪',
  'step': '⚪',
  'deepseek': '🟣',
  'alibaba': '🔴',
  'qwen': '🔴',
  'meta': '🟤',
  'llama': '🟤',
  'mistral': '🟡',
  'yi': '🔷',
  'moonshot': '🌙',
  'zhipu': '⚡',
  'glm': '⚡',
  'baidu': '🔵',
  'ernie': '🔵',
  'doubao': '🐼',
  'default': '✨'
};

export const PROVIDER_COLORS: Record<string, string> = {
  'openai': '#2196f3',
  'anthropic': '#5a25a2',
  'google': '#4285f4',
  'stepfun': '#ffffff',
  'deepseek': '#6c5ce7',
  'alibaba': '#ff5722',
  'meta': '#3b5998',
  'mistral': '#f39c12',
  'yi': '#00bcd4',
  'moonshot': '#3498db',
  'zhipu': '#e74c3c',
  'baidu': '#231955',
  'doubao': '#ff6b6b'
};

export class ModelRegistry implements IModelRegistry {
  public models: Map<string, ModelConfig> = new Map();
  public nameIndex: Map<string, ModelConfig> = new Map();
  public aliasIndex: Map<string, ModelConfig[]> = new Map();
  public providers: Map<string, ModelProvider> = new Map();
  public activeModelId: string | null = null;
  public modelHistory: string[] = [];
  private switchEvents: ModelSwitchEvent[] = [];
  private apiKeyStore: Map<string, string> = new Map();

  constructor() {}

  registerModel(model: ModelConfig): void {
    if (!model.icon) {
      model.icon = this.getModelIcon(model);
    }

    this.models.set(model.id, model);
    this.nameIndex.set(model.name.toLowerCase(), model);

    const aliases = model.aliases || [];
    aliases.push(model.name);
    for (const alias of aliases) {
      const lowerAlias = alias.toLowerCase();
      if (!this.aliasIndex.has(lowerAlias)) {
        this.aliasIndex.set(lowerAlias, []);
      }
      this.aliasIndex.get(lowerAlias)!.push(model);
    }

    const providerId = model.provider.toLowerCase();
    if (!this.providers.has(providerId)) {
      this.providers.set(providerId, {
        id: providerId,
        name: model.provider,
        baseUrl: model.baseUrl,
        models: [],
        priority: 100
      });
    }
    this.providers.get(providerId)!.models.push(model);

    if (model.apiKey && model.apiKey.length > 0) {
      this.storeApiKey(model.id, model.apiKey);
    }
  }

  registerModelsFromJSON(json: string): { registered: number; errors: string[] } {
    try {
      const data = JSON.parse(json);
      const errors: string[] = [];
      let registered = 0;

      const modelsArray = Array.isArray(data) ? data : [data];
      
      for (const item of modelsArray) {
        try {
          const model: ModelConfig = {
            id: item.id || uuidv4(),
            name: item.name || item.id,
            displayName: item.displayName || item.name || item.id,
            provider: item.provider || 'unknown',
            apiKey: item.apiKey || '',
            baseUrl: item.baseUrl || 'https://api.openai.com/v1',
            maxTokens: item.maxTokens || 4096,
            supportsVision: item.supportsVision || false,
            supportsTools: item.supportsTools || false,
            costPer1KInput: item.costPer1KInput || 0,
            costPer1KOutput: item.costPer1KOutput || 0,
            icon: item.icon || this.getModelIconFromName(item.name || item.id),
            keywords: item.keywords || [item.name],
            aliases: item.aliases || [],
            version: item.version,
            deprecated: item.deprecated || false
          };
          this.registerModel(model);
          registered++;
        } catch (e) {
          errors.push(`Failed to register model: ${e}`);
        }
      }

      return { registered, errors };
    } catch (error) {
      return { registered: 0, errors: [`Invalid JSON: ${error}`] };
    }
  }

  switchModel(options: ModelSwitchOptions): ModelConfig | null {
    const { modelName, preserveContext = true } = options;
    const lowerName = modelName.toLowerCase();

    let newModel = this.nameIndex.get(lowerName);
    
    if (!newModel) {
      const aliasMatches = this.aliasIndex.get(lowerName);
      if (aliasMatches && aliasMatches.length > 0) {
        newModel = aliasMatches[0];
      }
    }

    if (!newModel) {
      newModel = this.findModelByFuzzyMatch(lowerName);
    }

    if (!newModel) {
      return null;
    }

    const previousModelId = this.activeModelId;
    const previousModel = previousModelId ? this.models.get(previousModelId) : null;

    this.switchEvents.push({
      fromModelId: previousModelId || '',
      fromModelName: previousModel?.name || 'none',
      toModelId: newModel.id,
      toModelName: newModel.name,
      reason: `Switched to ${modelName}`,
      timestamp: new Date()
    });

    this.activeModelId = newModel.id;
    this.modelHistory = [newModel.id, ...this.modelHistory.filter(id => id !== newModel.id)].slice(0, 50);

    return newModel;
  }

  getModel(nameOrId: string): ModelConfig | undefined {
    const lower = nameOrId.toLowerCase();

    if (this.models.has(nameOrId)) {
      return this.models.get(nameOrId);
    }

    if (this.nameIndex.has(lower)) {
      return this.nameIndex.get(lower);
    }

    if (this.aliasIndex.has(lower)) {
      return this.aliasIndex.get(lower)![0];
    }

    return this.findModelByFuzzyMatch(lower);
  }

  private findModelByFuzzyMatch(query: string): ModelConfig | undefined {
    const lowerQuery = query.toLowerCase();
    let bestMatch: ModelConfig | undefined;
    let bestScore = 0;

    for (const model of this.models.values()) {
      let score = 0;
      
      if (model.name.toLowerCase().includes(lowerQuery)) score += 10;
      if (model.displayName.toLowerCase().includes(lowerQuery)) score += 8;
      
      for (const keyword of model.keywords) {
        if (keyword.toLowerCase().includes(lowerQuery)) score += 5;
        if (lowerQuery.includes(keyword.toLowerCase())) score += 3;
      }
      
      if (model.provider.toLowerCase().includes(lowerQuery)) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = model;
      }
    }

    return bestScore >= 3 ? bestMatch : undefined;
  }

  getActiveModel(): ModelConfig | null {
    if (!this.activeModelId) return null;
    return this.models.get(this.activeModelId) || null;
  }

  listModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  listByProvider(provider: string): ModelConfig[] {
    const providerModels = this.providers.get(provider.toLowerCase());
    return providerModels?.models || [];
  }

  getHistory(): ModelConfig[] {
    return this.modelHistory
      .map(id => this.models.get(id))
      .filter((m): m is ModelConfig => m !== undefined);
  }

  createGroup(group: ModelGroup): void {
    for (const modelId of group.modelIds) {
      if (!this.models.has(modelId)) {
        throw new Error(`Model ${modelId} not found`);
      }
    }
  }

  getSwitchHistory(limit = 20): ModelSwitchEvent[] {
    return this.switchEvents.slice(-limit);
  }

  exportConfig(): string {
    const config = {
      activeModelId: this.activeModelId,
      modelHistory: this.modelHistory,
      models: Array.from(this.models.values()).map(m => ({
        ...m,
        apiKey: m.apiKey ? '***REDACTED***' : ''
      })),
      providers: Array.from(this.providers.values()).map(p => ({
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        priority: p.priority
      }))
    };
    return JSON.stringify(config, null, 2);
  }

  importConfig(json: string): { imported: number; errors: string[] } {
    try {
      const config = JSON.parse(json);
      const errors: string[] = [];
      let imported = 0;

      if (config.activeModelId && this.models.has(config.activeModelId)) {
        this.activeModelId = config.activeModelId;
      }

      if (Array.isArray(config.models)) {
        for (const model of config.models) {
          try {
            const modelConfig: ModelConfig = {
              id: model.id || uuidv4(),
              name: model.name || model.id,
              displayName: model.displayName || model.name || model.id,
              provider: model.provider || 'unknown',
              apiKey: model.apiKey || '',
              baseUrl: model.baseUrl || 'https://api.openai.com/v1',
              maxTokens: model.maxTokens || 4096,
              supportsVision: model.supportsVision || false,
              supportsTools: model.supportsTools || false,
              costPer1KInput: model.costPer1KInput || 0,
              costPer1KOutput: model.costPer1KOutput || 0,
              icon: model.icon || this.getModelIconFromName(model.name || model.id),
              keywords: model.keywords || [model.name],
              aliases: model.aliases || [],
              version: model.version,
              deprecated: model.deprecated || false
            };
            this.registerModel(modelConfig);
            imported++;
          } catch (e) {
            errors.push(`Failed to import model: ${e}`);
          }
        }
      }

      return { imported, errors };
    } catch (error) {
      return { imported: 0, errors: [`Invalid config: ${error}`] };
    }
  }

  storeApiKey(modelId: string, apiKey: string): void {
    this.apiKeyStore.set(modelId, apiKey);
    const model = this.models.get(modelId);
    if (model) {
      model.apiKey = apiKey;
    }
  }

  getApiKey(modelId: string): string | undefined {
    return this.apiKeyStore.get(modelId);
  }

  clearApiKey(modelId: string): void {
    this.apiKeyStore.delete(modelId);
    const model = this.models.get(modelId);
    if (model) {
      model.apiKey = '';
    }
  }

  getModelIcon(model: ModelConfig): string {
    return this.getModelIconFromName(model.name);
  }

  getModelIconFromName(name: string): string {
    const lowerName = name.toLowerCase();
    
    for (const [keyword, icon] of Object.entries(MODEL_ICONS)) {
      if (lowerName.includes(keyword)) {
        return icon;
      }
    }
    
    return MODEL_ICONS['default'];
  }

  getProviderIcon(provider: string): string {
    const lowerProvider = provider.toLowerCase();
    
    for (const [keyword, icon] of Object.entries(MODEL_ICONS)) {
      if (lowerProvider.includes(keyword)) {
        return icon;
      }
    }
    
    return MODEL_ICONS['default'];
  }

  getProviderColor(provider: string): string {
    const lowerProvider = provider.toLowerCase();
    return PROVIDER_COLORS[lowerProvider] || '#666666';
  }

  searchModels(query: string, limit = 10): ModelConfig[] {
    const lowerQuery = query.toLowerCase();
    const results: { model: ModelConfig; score: number }[] = [];

    for (const model of this.models.values()) {
      let score = 0;
      
      if (model.name.toLowerCase().includes(lowerQuery)) score += 10;
      if (model.displayName.toLowerCase().includes(lowerQuery)) score += 8;
      if (model.provider.toLowerCase().includes(lowerQuery)) score += 5;
      
      for (const keyword of model.keywords) {
        if (keyword.toLowerCase().includes(lowerQuery)) score += 3;
      }

      if (score > 0) {
        results.push({ model, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(r => r.model);
  }

  removeModel(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    this.models.delete(modelId);
    this.nameIndex.delete(model.name.toLowerCase());
    
    for (const alias of model.aliases || []) {
      const aliasList = this.aliasIndex.get(alias.toLowerCase());
      if (aliasList) {
        const filtered = aliasList.filter(m => m.id !== modelId);
        if (filtered.length === 0) {
          this.aliasIndex.delete(alias.toLowerCase());
        } else {
          this.aliasIndex.set(alias.toLowerCase(), filtered);
        }
      }
    }

    const providerId = model.provider.toLowerCase();
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.models = provider.models.filter(m => m.id !== modelId);
    }

    this.clearApiKey(modelId);

    if (this.activeModelId === modelId) {
      this.activeModelId = null;
    }

    this.modelHistory = this.modelHistory.filter(id => id !== modelId);

    return true;
  }

  updateModel(modelId: string, updates: Partial<ModelConfig>): ModelConfig | null {
    const model = this.models.get(modelId);
    if (!model) return null;

    const oldName = model.name;
    Object.assign(model, updates);

    if (updates.name) {
      this.nameIndex.delete(oldName.toLowerCase());
      this.nameIndex.set(updates.name.toLowerCase(), model);
    }

    if (updates.apiKey !== undefined) {
      if (updates.apiKey) {
        this.storeApiKey(modelId, updates.apiKey);
      } else {
        this.clearApiKey(modelId);
      }
    }

    if (updates.icon === undefined) {
      model.icon = this.getModelIcon(model);
    }

    return model;
  }

  listProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  getStats() {
    return {
      totalModels: this.models.size,
      totalProviders: this.providers.size,
      activeModelId: this.activeModelId,
      historySize: this.modelHistory.length,
      switchEventCount: this.switchEvents.length
    };
  }
}

export function createModelRegistry(): ModelRegistry {
  const registry = new ModelRegistry();

  const standardModels: ModelConfig[] = [
    {
      id: 'gpt-4o',
      name: 'gpt-4o',
      displayName: 'GPT-4o',
      provider: 'OpenAI',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      maxTokens: 128000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.005,
      costPer1KOutput: 0.015,
      icon: '🤖',
      keywords: ['gpt', 'openai', '4o'],
      aliases: ['gpt4o', 'gpt-4', 'gpt4', 'openai-gpt-4o']
    },
    {
      id: 'claude-3.5-sonnet',
      name: 'claude-3.5-sonnet',
      displayName: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      apiKey: '',
      baseUrl: 'https://api.anthropic.com/v1',
      maxTokens: 200000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.003,
      costPer1KOutput: 0.015,
      icon: '🔵',
      keywords: ['claude', 'anthropic', 'sonnet'],
      aliases: ['claude-3-5-sonnet', 'claude-3.5', 'claude-sonnet']
    },
    {
      id: 'gemini-2.5-pro',
      name: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      provider: 'Google',
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      maxTokens: 1000000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.00125,
      costPer1KOutput: 0.005,
      icon: '🌈',
      keywords: ['gemini', 'google', 'pro'],
      aliases: ['gemini-2.5', 'gemini-pro', 'gemini-2.5-pro-exp']
    },
    {
      id: 'step-3.5-flash',
      name: 'step-3.5-flash',
      displayName: 'Step 3.5 Flash',
      provider: 'StepFun',
      apiKey: '',
      baseUrl: 'https://api.stepfun.com/v1',
      maxTokens: 128000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.0001,
      costPer1KOutput: 0.0004,
      icon: '⚪',
      keywords: ['step', 'stepfun', '阶跃'],
      aliases: ['step-3.5', 'stepfun-3.5', 'step-3.5-flash-202503']
    },
    {
      id: 'deepseek-v3',
      name: 'deepseek-v3',
      displayName: 'DeepSeek V3',
      provider: 'DeepSeek',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      maxTokens: 64000,
      supportsVision: false,
      supportsTools: true,
      costPer1KInput: 0.00027,
      costPer1KOutput: 0.0011,
      icon: '🟣',
      keywords: ['deepseek', 'deep', 'v3'],
      aliases: ['deepseek-3', 'deepseek-v3-2025']
    },
    {
      id: 'qwen-2.5-72b',
      name: 'qwen-2.5-72b',
      displayName: 'Qwen 2.5 72B',
      provider: 'Alibaba',
      apiKey: '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      maxTokens: 32000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.0004,
      costPer1KOutput: 0.0008,
      icon: '🔴',
      keywords: ['qwen', 'alibaba', 'tongyi'],
      aliases: ['qwen-2.5', 'qwen2.5-72b', 'qwen-turbo']
    },
    {
      id: 'llama-3.1-405b',
      name: 'llama-3.1-405b',
      displayName: 'Llama 3.1 405B',
      provider: 'Meta',
      apiKey: '',
      baseUrl: 'https://api.meta.ai/v1',
      maxTokens: 128000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.0008,
      costPer1KOutput: 0.0024,
      icon: '🟤',
      keywords: ['llama', 'meta', 'facebook'],
      aliases: ['llama-3.1', 'llama3.1', 'llama3']
    },
    {
      id: 'mistral-large',
      name: 'mistral-large',
      displayName: 'Mistral Large',
      provider: 'Mistral',
      apiKey: '',
      baseUrl: 'https://api.mistral.ai/v1',
      maxTokens: 32000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.002,
      costPer1KOutput: 0.006,
      icon: '🟡',
      keywords: ['mistral', 'large'],
      aliases: ['mistral-large-latest', 'mistral-large-2407']
    },
    {
      id: 'yi-1.5-34b',
      name: 'yi-1.5-34b',
      displayName: 'Yi 1.5 34B',
      provider: 'Yi',
      apiKey: '',
      baseUrl: 'https://api.yi.com/v1',
      maxTokens: 128000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.0005,
      costPer1KOutput: 0.0015,
      icon: '🔷',
      keywords: ['yi', 'zero-one'],
      aliases: ['yi-34b', 'yi-large']
    },
    {
      id: 'moonshot-v1',
      name: 'moonshot-v1',
      displayName: 'Moonshot v1',
      provider: 'Moonshot',
      apiKey: '',
      baseUrl: 'https://api.moonshot.cn/v1',
      maxTokens: 128000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.002,
      costPer1KOutput: 0.006,
      icon: '🌙',
      keywords: ['moonshot', 'kimi'],
      aliases: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']
    },
    {
      id: 'glm-4',
      name: 'glm-4',
      displayName: 'GLM-4',
      provider: 'Zhipu',
      apiKey: '',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      maxTokens: 128000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.001,
      costPer1KOutput: 0.003,
      icon: '⚡',
      keywords: ['glm', 'zhipu', '智谱'],
      aliases: ['glm-4-9b', 'zhipu-glm-4']
    },
    {
      id: 'ernie-bot',
      name: 'ernie-bot',
      displayName: 'ERNIE Bot',
      provider: 'Baidu',
      apiKey: '',
      baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
      maxTokens: 64000,
      supportsVision: true,
      supportsTools: true,
      costPer1KInput: 0.0008,
      costPer1KOutput: 0.0024,
      icon: '🔵',
      keywords: ['ernie', 'baidu', 'wenxin'],
      aliases: ['ernie-bot-4', 'ernie-bot-turbo', 'wenxin']
    }
  ];

  for (const model of standardModels) {
    registry.registerModel(model);
  }

  return registry;
}

export function normalizeModelName(name: string): string {
  const lower = name.toLowerCase().trim();
  
  for (const [standard, aliases] of Object.entries(STANDARD_MODEL_NAMES)) {
    if (standard === lower || aliases.includes(lower)) {
      return standard;
    }
  }

  return lower;
}

export function suggestModelNames(input: string, limit = 5): string[] {
  const lower = input.toLowerCase();
  const suggestions: { name: string; score: number }[] = [];

  for (const standard of Object.keys(STANDARD_MODEL_NAMES)) {
    if (standard.includes(lower)) {
      suggestions.push({ name: standard, score: 10 });
    }
    for (const alias of STANDARD_MODEL_NAMES[standard]) {
      if (alias.includes(lower)) {
        suggestions.push({ name: standard, score: 5 });
        break;
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, limit).map(s => s.name);
}

export function getModelIconFromKeywords(keywords: string[]): string {
  for (const keyword of keywords) {
    const icon = MODEL_ICONS[keyword.toLowerCase()];
    if (icon) return icon;
  }
  return MODEL_ICONS['default'];
}