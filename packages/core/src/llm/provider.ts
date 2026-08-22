import { ModelConfig } from '../types';

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  finishReason?: string;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: LLMResponse['usage'];
}

export interface LLMProvider {
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  supportsStreaming: boolean;
  supportsTools: boolean;
  
  generate(
    model: ModelConfig,
    messages: Array<{ role: string; content: any }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      tools?: any[];
      toolChoice?: string | { type: string; function: { name: string } };
      signal?: AbortSignal;
    }
  ): Promise<LLMResponse>;

  stream(
    model: ModelConfig,
    messages: Array<{ role: string; content: any }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      tools?: any[];
      signal?: AbortSignal;
    }
  ): AsyncGenerator<LLMStreamChunk>;
}

export const PROVIDER_IMPLEMENTATIONS: Record<string, {
  baseUrl: string;
  apiKeyEnv: string;
  supportsStreaming: boolean;
  supportsTools: boolean;
  formatMessages: (messages: Array<{ role: string; content: string }>) => any[];
  extractContent: (response: any) => string;
  extractStreamContent: (chunk: any) => string;
}> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.content[0]?.text || '',
    extractStreamContent: (chunk) => chunk.delta?.text || ''
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GOOGLE_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.candidates[0]?.content?.parts?.[0]?.text || '',
    extractStreamContent: (chunk) => chunk.candidates[0]?.content?.parts?.[0]?.text || ''
  },
  stepfun: {
    baseUrl: 'https://api.stepfun.com/v1',
    apiKeyEnv: 'STEPFUN_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  alibaba: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  meta: {
    baseUrl: 'https://api.meta.ai/v1',
    apiKeyEnv: 'META_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  yi: {
    baseUrl: 'https://api.yi.com/v1',
    apiKeyEnv: 'YI_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'ZHIPU_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  baidu: {
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
    apiKeyEnv: 'BAIDU_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.result || response.choices?.[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.result || chunk.choices?.[0]?.delta?.content || ''
  },
  doubao: {
    baseUrl: 'https://api.doubao.com/v1',
    apiKeyEnv: 'DOUBAO_API_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  },
  newapi: {
    baseUrl: 'https://api.newapi.cn/v1',
    apiKeyEnv: 'NEWAPI_KEY',
    supportsStreaming: true,
    supportsTools: true,
    formatMessages: (messages) => messages,
    extractContent: (response) => response.choices[0]?.message?.content || '',
    extractStreamContent: (chunk) => chunk.choices[0]?.delta?.content || ''
  }
};

export class GenericLLMProvider implements LLMProvider {
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  supportsStreaming: boolean;
  supportsTools: boolean;

  constructor(providerName: string) {
    const impl = PROVIDER_IMPLEMENTATIONS[providerName.toLowerCase()] || PROVIDER_IMPLEMENTATIONS.openai;
    this.name = providerName;
    this.baseUrl = impl.baseUrl;
    this.apiKeyEnv = impl.apiKeyEnv;
    this.supportsStreaming = impl.supportsStreaming;
    this.supportsTools = impl.supportsTools;
  }

  async generate(
    model: ModelConfig,
    messages: Array<{ role: string; content: any }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      tools?: any[];
      toolChoice?: string | { type: string; function: { name: string } };
      signal?: AbortSignal;
    }
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const apiKey = model.apiKey || process.env[this.apiKeyEnv] || '';
    const url = `${model.baseUrl || this.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: model.name,
      messages: messages,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || model.maxTokens
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      if (options.toolChoice) {
        body.tool_choice = options.toolChoice;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      content?: Array<{ text?: string }>;
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      result?: string;
    };
    const latency = Date.now() - startTime;

    const impl = PROVIDER_IMPLEMENTATIONS[model.provider.toLowerCase()] || PROVIDER_IMPLEMENTATIONS.openai;
    
    return {
      content: impl.extractContent(data),
      model: model.name,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      latency,
      finishReason: data.choices?.[0]?.finish_reason
    };
  }

  async *stream(
    model: ModelConfig,
    messages: Array<{ role: string; content: any }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      tools?: any[];
      signal?: AbortSignal;
    }
  ): AsyncGenerator<LLMStreamChunk> {
    const apiKey = model.apiKey || process.env[this.apiKeyEnv] || '';
    const url = `${model.baseUrl || this.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: model.name,
      messages: messages,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || model.maxTokens,
      stream: true
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    const impl = PROVIDER_IMPLEMENTATIONS[model.provider.toLowerCase()] || PROVIDER_IMPLEMENTATIONS.openai;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') {
            yield { content: '', done: true };
            return;
          }
          try {
            const data = JSON.parse(jsonStr);
            const content = impl.extractStreamContent(data);
            if (content) {
              yield { content, done: false };
            }
          } catch {
            continue;
          }
        }
      }
    }

    yield { content: '', done: true };
  }
}

export class LLMProviderFactory {
  static create(providerName: string): LLMProvider {
    return new GenericLLMProvider(providerName);
  }

  static getSupportedProviders(): string[] {
    return Object.keys(PROVIDER_IMPLEMENTATIONS);
  }

  static hasProvider(providerName: string): boolean {
    return PROVIDER_IMPLEMENTATIONS.hasOwnProperty(providerName.toLowerCase());
  }

  static getProviderInfo(providerName: string): typeof PROVIDER_IMPLEMENTATIONS[string] | undefined {
    return PROVIDER_IMPLEMENTATIONS[providerName.toLowerCase()];
  }
}

export async function callLLM(
  model: ModelConfig,
  messages: Array<{ role: string; content: any }>,
  options?: {
    temperature?: number;
    maxTokens?: number;
    tools?: any[];
    toolChoice?: string | { type: string; function: { name: string } };
    streaming?: boolean;
    onChunk?: (chunk: LLMStreamChunk) => void;
    /** Abort signal to cancel in-flight fetch requests. */
    signal?: AbortSignal;
  }
): Promise<LLMResponse> {
  const provider = LLMProviderFactory.create(model.provider);

  if (options?.streaming && provider.supportsStreaming && options.onChunk) {
    const startTime = Date.now();
    let fullContent = '';
    for await (const chunk of provider.stream(model, messages, options)) {
      fullContent += chunk.content;
      options.onChunk(chunk);
      if (chunk.done) break;
    }

    return {
      content: fullContent,
      model: model.name,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      latency: Date.now() - startTime
    };
  }

  return provider.generate(model, messages, options);
}

export function calculateCost(model: ModelConfig, usage: LLMResponse['usage']): number {
  return (usage.promptTokens / 1000) * model.costPer1KInput + 
         (usage.completionTokens / 1000) * model.costPer1KOutput;
}
