"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMProviderFactory = exports.GenericLLMProvider = exports.PROVIDER_IMPLEMENTATIONS = void 0;
exports.callLLM = callLLM;
exports.calculateCost = calculateCost;
exports.PROVIDER_IMPLEMENTATIONS = {
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
class GenericLLMProvider {
    name;
    baseUrl;
    apiKeyEnv;
    supportsStreaming;
    supportsTools;
    constructor(providerName) {
        const impl = exports.PROVIDER_IMPLEMENTATIONS[providerName.toLowerCase()] || exports.PROVIDER_IMPLEMENTATIONS.openai;
        this.name = providerName;
        this.baseUrl = impl.baseUrl;
        this.apiKeyEnv = impl.apiKeyEnv;
        this.supportsStreaming = impl.supportsStreaming;
        this.supportsTools = impl.supportsTools;
    }
    async generate(model, messages, options) {
        const startTime = Date.now();
        const apiKey = model.apiKey || process.env[this.apiKeyEnv] || '';
        const url = `${model.baseUrl || this.baseUrl}/chat/completions`;
        const body = {
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
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const latency = Date.now() - startTime;
        const impl = exports.PROVIDER_IMPLEMENTATIONS[model.provider.toLowerCase()] || exports.PROVIDER_IMPLEMENTATIONS.openai;
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
    async *stream(model, messages, options) {
        const apiKey = model.apiKey || process.env[this.apiKeyEnv] || '';
        const url = `${model.baseUrl || this.baseUrl}/chat/completions`;
        const body = {
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
            body: JSON.stringify(body)
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
        const impl = exports.PROVIDER_IMPLEMENTATIONS[model.provider.toLowerCase()] || exports.PROVIDER_IMPLEMENTATIONS.openai;
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
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
                    }
                    catch {
                        continue;
                    }
                }
            }
        }
        yield { content: '', done: true };
    }
}
exports.GenericLLMProvider = GenericLLMProvider;
class LLMProviderFactory {
    static create(providerName) {
        return new GenericLLMProvider(providerName);
    }
    static getSupportedProviders() {
        return Object.keys(exports.PROVIDER_IMPLEMENTATIONS);
    }
    static hasProvider(providerName) {
        return exports.PROVIDER_IMPLEMENTATIONS.hasOwnProperty(providerName.toLowerCase());
    }
    static getProviderInfo(providerName) {
        return exports.PROVIDER_IMPLEMENTATIONS[providerName.toLowerCase()];
    }
}
exports.LLMProviderFactory = LLMProviderFactory;
async function callLLM(model, messages, options) {
    const provider = LLMProviderFactory.create(model.provider);
    if (options?.streaming && provider.supportsStreaming && options.onChunk) {
        let fullContent = '';
        for await (const chunk of provider.stream(model, messages, options)) {
            fullContent += chunk.content;
            options.onChunk(chunk);
            if (chunk.done)
                break;
        }
        return {
            content: fullContent,
            model: model.name,
            usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            },
            latency: 0
        };
    }
    return provider.generate(model, messages, options);
}
function calculateCost(model, usage) {
    return (usage.promptTokens / 1000) * model.costPer1KInput +
        (usage.completionTokens / 1000) * model.costPer1KOutput;
}
//# sourceMappingURL=provider.js.map