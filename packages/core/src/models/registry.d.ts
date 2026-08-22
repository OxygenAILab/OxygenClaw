import { ModelConfig, ModelProvider, ModelRegistry as IModelRegistry, ModelSwitchOptions, ModelGroup, ModelSwitchEvent } from '../types';
export declare const STANDARD_MODEL_NAMES: Record<string, string[]>;
export declare const MODEL_ICONS: Record<string, string>;
export declare const PROVIDER_COLORS: Record<string, string>;
export declare class ModelRegistry implements IModelRegistry {
    models: Map<string, ModelConfig>;
    nameIndex: Map<string, ModelConfig>;
    aliasIndex: Map<string, ModelConfig[]>;
    providers: Map<string, ModelProvider>;
    activeModelId: string | null;
    modelHistory: string[];
    private switchEvents;
    private apiKeyStore;
    constructor();
    registerModel(model: ModelConfig): void;
    registerModelsFromJSON(json: string): {
        registered: number;
        errors: string[];
    };
    switchModel(options: ModelSwitchOptions): ModelConfig | null;
    getModel(nameOrId: string): ModelConfig | undefined;
    private findModelByFuzzyMatch;
    getActiveModel(): ModelConfig | null;
    listModels(): ModelConfig[];
    listByProvider(provider: string): ModelConfig[];
    getHistory(): ModelConfig[];
    createGroup(group: ModelGroup): void;
    getSwitchHistory(limit?: number): ModelSwitchEvent[];
    exportConfig(): string;
    importConfig(json: string): {
        imported: number;
        errors: string[];
    };
    storeApiKey(modelId: string, apiKey: string): void;
    getApiKey(modelId: string): string | undefined;
    clearApiKey(modelId: string): void;
    getModelIcon(model: ModelConfig): string;
    getModelIconFromName(name: string): string;
    getProviderIcon(provider: string): string;
    getProviderColor(provider: string): string;
    searchModels(query: string, limit?: number): ModelConfig[];
    removeModel(modelId: string): boolean;
    updateModel(modelId: string, updates: Partial<ModelConfig>): ModelConfig | null;
    listProviders(): ModelProvider[];
    getStats(): {
        totalModels: number;
        totalProviders: number;
        activeModelId: string | null;
        historySize: number;
        switchEventCount: number;
    };
}
export declare function createModelRegistry(): ModelRegistry;
export declare function normalizeModelName(name: string): string;
export declare function suggestModelNames(input: string, limit?: number): string[];
export declare function getModelIconFromKeywords(keywords: string[]): string;
//# sourceMappingURL=registry.d.ts.map