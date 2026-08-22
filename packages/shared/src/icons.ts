/**
 * Model Icons - Keyword-based matching
 * Integrated from: OpenClaw + UI-TARS ecosystem
 * Enhanced with model switching support
 */

import { ModelConfig } from '@oxygen-claw/core';

/**
 * Model icon mapping based on keywords
 */
export const MODEL_ICONS: Record<string, string> = {
  // OpenAI
  'gpt': '🟢',
  'openai': '🟢',
  'o1': '🟢',
  'o3': '🟢',
  
  // Anthropic
  'claude': '🟠',
  'anthropic': '🟠',
  
  // Google
  'gemini': '🔵',
  'google': '🔵',
  'palm': '🔵',
  
  // Chinese providers
  'deepseek': '🟣',
  'deep': '🟣',
  'qwen': '🔴',
  'tongyi': '🔴',
  'alibaba': '🔴',
  'step': '⚪',
  'stepfun': '⚪',
  '阶跃': '⚪',
  'yi': '🩷',
  'zero': '🩷',
  'moonshot': '🌙',
  'kimi': '🌙',
  'zhipu': '💚',
  'glm': '💚',
  'baichuan': '🟡',
  'baidu': '🟡',
  'ernie': '🔵',
  'wenxin': '🔵',
  
  // Meta
  'llama': '🟤',
  'meta': '🟤',
  'facebook': '🟤',
  
  // Mistral
  'mistral': '🟡',
  'mixtral': '🟡',
  
  // Other
  'cohere': '🟣',
  'command': '🟣',
  'ai21': '🔵',
  'jamba': '🟢',
  'reka': '🟠',
  'perplexity': '🟠',
};

/**
 * Default icons for providers without keywords
 */
export const PROVIDER_ICONS: Record<string, string> = {
  'openai': '🟢',
  'anthropic': '🟠',
  'google': '🔵',
  'deepseek': '🟣',
  'alibaba': '🔴',
  'stepfun': '⚪',
  'meta': '🟤',
  'mistral': '🟡',
  'cohere': '🟣',
  'reka': '🟠',
  'default': '🤖',
};

/**
 * Standard model names and their aliases for switching
 */
export const STANDARD_MODEL_NAMES: Record<string, string[]> = {
  // OpenAI
  'gpt-4o': ['gpt-4o', 'gpt4o', 'gpt-4', 'gpt4', 'openai-gpt-4o'],
  'gpt-4-turbo': ['gpt-4-turbo', 'gpt4-turbo', 'gpt-4-turbo-preview'],
  'gpt-4': ['gpt-4', 'gpt4', 'gpt-4-0314'],
  'gpt-3.5-turbo': ['gpt-3.5-turbo', 'gpt-3.5', 'gpt35'],
  
  // Anthropic
  'claude-3.5-sonnet': ['claude-3-5-sonnet', 'claude-3.5-sonnet', 'claude-sonnet'],
  'claude-3-opus': ['claude-3-opus', 'claude-opus'],
  'claude-3-sonnet': ['claude-3-sonnet', 'claude-sonnet'],
  'claude-3-haiku': ['claude-3-haiku', 'claude-haiku'],
  
  // Google
  'gemini-2.5-pro': ['gemini-2.5-pro', 'gemini-pro-2.5'],
  'gemini-2.5-flash': ['gemini-2.5-flash', 'gemini-flash-2.5'],
  'gemini-1.5-pro': ['gemini-1.5-pro', 'gemini-pro'],
  'gemini-1.5-flash': ['gemini-1.5-flash', 'gemini-flash'],
  
  // StepFun
  'step-3.5-flash': ['step-3.5-flash', 'step-3.5', 'stepfun-3.5'],
  'step-2-16k': ['step-2-16k', 'step-2', 'stepfun-2'],
  
  // DeepSeek
  'deepseek-v3': ['deepseek-v3', 'deepseek-3'],
  'deepseek-r1': ['deepseek-r1', 'deepseek-reasoner'],
  'deepseek-chat': ['deepseek-chat', 'deepseek-v2'],
  
  // Alibaba
  'qwen-2.5-72b': ['qwen-2.5-72b', 'qwen-2.5', 'qwen-turbo'],
  'qwen-2.5-7b': ['qwen-2.5-7b', 'qwen2.5-7b'],
  
  // Meta
  'llama-3.1-405b': ['llama-3.1-405b', 'llama-3.1', 'llama3'],
  'llama-3.1-70b': ['llama-3.1-70b', 'llama3.1-70b'],
  'llama-3': ['llama-3', 'llama-3-8b', 'llama-3-70b'],
  
  // Mistral
  'mistral-large': ['mistral-large', 'mistral-large-latest'],
  'mistral-medium': ['mistral-medium'],
  'mistral-small': ['mistral-small', 'mistral-small-latest'],
  'codestral': ['codestral', 'codestral-latest'],
  
  // Other
  'yi-1.5-34b': ['yi-1.5-34b', 'yi-34b', 'yi-large'],
  'moonshot-v1': ['moonshot-v1', 'moonshot-v1-8k'],
  'glm-4': ['glm-4', 'zhipu-glm-4'],
  'ernie-bot': ['ernie-bot', 'ernie-bot-4', 'wenxin'],
};

/**
 * Get icon for a model based on keywords or provider
 */
export function getModelIcon(model: ModelConfig): string {
  // Check keywords first
  for (const keyword of model.keywords) {
    const lowerKeyword = keyword.toLowerCase();
    for (const [key, icon] of Object.entries(MODEL_ICONS)) {
      if (lowerKeyword.includes(key) || key.includes(lowerKeyword)) {
        return icon;
      }
    }
  }

  // Check provider
  const providerLower = model.provider.toLowerCase();
  for (const [key, icon] of Object.entries(PROVIDER_ICONS)) {
    if (providerLower.includes(key) || key.includes(providerLower)) {
      return icon;
    }
  }

  return PROVIDER_ICONS.default;
}

/**
 * Find model by keywords with fuzzy matching
 */
export function findModelByKeywords(
  models: ModelConfig[],
  keywords: string[]
): ModelConfig | undefined {
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  // Calculate score for each model
  const scored = models.map(model => {
    let score = 0;
    const modelKeywords = model.keywords.map(k => k.toLowerCase());
    const modelName = model.name.toLowerCase();
    const provider = model.provider.toLowerCase();

    for (const keyword of lowerKeywords) {
      // Exact match
      if (modelKeywords.includes(keyword)) score += 10;
      if (modelName.includes(keyword)) score += 8;
      if (provider.includes(keyword)) score += 5;

      // Partial match
      for (const mk of modelKeywords) {
        if (mk.includes(keyword) || keyword.includes(mk)) score += 3;
      }
    }

    return { model, score };
  });

  // Sort by score and return best match
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].model : undefined;
}

/**
 * Get model color based on provider
 */
export function getModelColor(provider: string): string {
  const colors: Record<string, string> = {
    'OpenAI': '#10a37f',
    'Anthropic': '#d4a27f',
    'Google': '#4285f4',
    'DeepSeek': '#6366f1',
    'Alibaba': '#ff6a00',
    'StepFun': '#e0e0e0',
    'Meta': '#0668e1',
    'Mistral': '#ff7000',
    'Cohere': '#39594d',
    'Reka': '#ff6b6b',
  };

  return colors[provider] || '#9e9e9e';
}

/**
 * Normalize model name to standard name
 */
export function normalizeModelName(name: string): string {
  const lower = name.toLowerCase().trim();
  
  for (const [standard, aliases] of Object.entries(STANDARD_MODEL_NAMES)) {
    if (standard === lower || aliases.includes(lower)) {
      return standard;
    }
  }

  return lower;
}

/**
 * Get standard name suggestions for partial input
 */
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
