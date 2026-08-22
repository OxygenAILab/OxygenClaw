/**
 * Gateway Router
 * Smart LLM routing, API Key management, billing, multi-model switching
 * Integrated from: NewAPI architecture
 */
import { Request, Response, NextFunction } from 'express';
import { ModelConfig, ModelProvider, GatewayConfig, DashboardStats, ModelRegistry, ModelSwitchOptions, ModelSwitchEvent } from '../core/src/types';
export interface GatewayConfigExtended extends GatewayConfig {
    models: ModelConfig[];
    providers: ModelProvider[];
    modelRegistry: ModelRegistry;
}
interface RequestStats {
    timestamp: Date;
    modelId: string;
    modelName: string;
    tokensUsed: number;
    cost: number;
    apiKeyHash: string;
    latency: number;
}
export declare class SmartRouter {
    private config;
    private modelRegistry;
    private stats;
    private apiKeys;
    constructor(config: GatewayConfigExtended);
    /**
     * Initialize router with default model
     */
    initialize(): void;
    /**
     * Switch active model by name
     */
    switchModel(options: ModelSwitchOptions): {
        success: boolean;
        model?: ModelConfig;
        error?: string;
    };
    /**
     * Get current active model
     */
    getActiveModel(): ModelConfig | null;
    /**
     * Get model by name or ID
     */
    getModel(nameOrId: string): ModelConfig | undefined;
    /**
     * List all available models
     */
    listModels(): ModelConfig[];
    /**
     * Get model suggestions for autocomplete
     */
    getModelSuggestions(query: string): string[];
    /**
     * Route request to best model based on task
     */
    selectModel(task: {
        prompt: string;
        requiresVision: boolean;
        requiresTools: boolean;
        maxTokens: number;
        budget?: number;
        preferredModel?: string;
    }): ModelConfig | null;
    /**
     * Auto-select best model for task
     */
    private autoSelectModel;
    /**
     * Check if model meets task requirements
     */
    private checkModelCapabilities;
    /**
     * Validate API key
     */
    validateApiKey(apiKey: string): boolean;
    /**
     * Add API key
     */
    addApiKey(apiKey: string, quota?: number): string;
    /**
     * Remove API key
     */
    removeApiKey(apiKey: string): boolean;
    /**
     * Record request for billing
     */
    recordRequest(stats: Omit<RequestStats, 'timestamp' | 'modelName'> & {
        modelName?: string;
    }): void;
    /**
     * Get dashboard stats
     */
    getStats(timeRange?: 'hour' | 'day' | 'week'): DashboardStats;
    /**
     * Get switch history
     */
    getSwitchHistory(limit?: number): ModelSwitchEvent[];
    /**
     * Middleware for Express
     */
    middleware(): (req: Request, res: Response, next: NextFunction) => any;
    /**
     * Hash API key for storage
     */
    private hashApiKey;
    /**
     * Import models from JSON
     */
    importModelsFromJSON(json: string): {
        imported: number;
        errors: string[];
    };
    /**
     * Get model registry
     */
    getModelRegistry(): ModelRegistry;
    /**
     * Export all configuration
     */
    exportConfiguration(): string;
    /**
     * Import configuration
     */
    importConfiguration(json: string): {
        imported: number;
        errors: string[];
    };
}
export declare function createGateway(config: GatewayConfigExtended): SmartRouter;
/**
 * Create default gateway config with model registry
 */
export declare function createDefaultGatewayConfig(): GatewayConfigExtended;
export {};
//# sourceMappingURL=router.d.ts.map