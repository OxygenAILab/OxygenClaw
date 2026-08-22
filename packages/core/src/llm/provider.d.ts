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
    generate(model: ModelConfig, messages: Array<{
        role: string;
        content: any;
    }>, options?: {
        temperature?: number;
        maxTokens?: number;
        tools?: any[];
        toolChoice?: string | {
            type: string;
            function: {
                name: string;
            };
        };
    }): Promise<LLMResponse>;
    stream(model: ModelConfig, messages: Array<{
        role: string;
        content: any;
    }>, options?: {
        temperature?: number;
        maxTokens?: number;
        tools?: any[];
    }): AsyncGenerator<LLMStreamChunk>;
}
export declare const PROVIDER_IMPLEMENTATIONS: Record<string, {
    baseUrl: string;
    apiKeyEnv: string;
    supportsStreaming: boolean;
    supportsTools: boolean;
    formatMessages: (messages: Array<{
        role: string;
        content: string;
    }>) => any[];
    extractContent: (response: any) => string;
    extractStreamContent: (chunk: any) => string;
}>;
export declare class GenericLLMProvider implements LLMProvider {
    name: string;
    baseUrl: string;
    apiKeyEnv: string;
    supportsStreaming: boolean;
    supportsTools: boolean;
    constructor(providerName: string);
    generate(model: ModelConfig, messages: Array<{
        role: string;
        content: any;
    }>, options?: {
        temperature?: number;
        maxTokens?: number;
        tools?: any[];
        toolChoice?: string | {
            type: string;
            function: {
                name: string;
            };
        };
    }): Promise<LLMResponse>;
    stream(model: ModelConfig, messages: Array<{
        role: string;
        content: any;
    }>, options?: {
        temperature?: number;
        maxTokens?: number;
        tools?: any[];
    }): AsyncGenerator<LLMStreamChunk>;
}
export declare class LLMProviderFactory {
    static create(providerName: string): LLMProvider;
    static getSupportedProviders(): string[];
    static hasProvider(providerName: string): boolean;
    static getProviderInfo(providerName: string): typeof PROVIDER_IMPLEMENTATIONS[string] | undefined;
}
export declare function callLLM(model: ModelConfig, messages: Array<{
    role: string;
    content: any;
}>, options?: {
    temperature?: number;
    maxTokens?: number;
    tools?: any[];
    toolChoice?: string | {
        type: string;
        function: {
            name: string;
        };
    };
    streaming?: boolean;
    onChunk?: (chunk: LLMStreamChunk) => void;
}): Promise<LLMResponse>;
export declare function calculateCost(model: ModelConfig, usage: LLMResponse['usage']): number;
//# sourceMappingURL=provider.d.ts.map