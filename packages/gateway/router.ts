/**
 * Gateway Router
 * Smart LLM routing, API Key management, billing, multi-model switching
 * Integrated from: NewAPI architecture
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  ModelConfig,
  ModelProvider,
  GatewayConfig,
  DashboardStats,
  ModelRegistry,
  ModelSwitchOptions,
  ModelSwitchEvent
} from '../core/src/types';
import { createModelRegistry, normalizeModelName, suggestModelNames, STANDARD_MODEL_NAMES } from '../core/src/models/registry';

// ============================================
// Gateway Configuration Extended
// ============================================
export interface GatewayConfigExtended extends GatewayConfig {
  models: ModelConfig[];
  providers: ModelProvider[];
  modelRegistry: ModelRegistry;
}

// ============================================
// Router Statistics
// ============================================
interface RequestStats {
  timestamp: Date;
  modelId: string;
  modelName: string;
  tokensUsed: number;
  cost: number;
  apiKeyHash: string;
  latency: number;
}

// ============================================
// Smart Router with Multi-Model Switching
// ============================================
export class SmartRouter {
  private config: GatewayConfigExtended;
  private modelRegistry: ModelRegistry;
  private stats: RequestStats[] = [];
  private apiKeys: Map<string, { hash: string; key: string; createdAt: Date; quota: number }> = new Map();

  constructor(config: GatewayConfigExtended) {
    this.config = config;
    this.modelRegistry = config.modelRegistry;
  }

  /**
   * Initialize router with default model
   */
  initialize(): void {
    if (this.config.defaultModelId) {
      this.modelRegistry.switchModel({ modelName: this.config.defaultModelId });
    } else if (this.modelRegistry.listModels().length > 0) {
      this.modelRegistry.switchModel({ modelName: this.modelRegistry.listModels()[0].name });
    }
  }

  /**
   * Switch active model by name
   */
  switchModel(options: ModelSwitchOptions): { success: boolean; model?: ModelConfig; error?: string } {
    try {
      const model = this.modelRegistry.switchModel(options);
      if (!model) {
        // Try to suggest similar model names
        const suggestions = suggestModelNames(options.modelName);
        return {
          success: false,
          error: `Model "${options.modelName}" not found. Did you mean: ${suggestions.join(', ')}?`
        };
      }
      return { success: true, model };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get current active model
   */
  getActiveModel(): ModelConfig | null {
    return this.modelRegistry.getActiveModel();
  }

  /**
   * Get model by name or ID
   */
  getModel(nameOrId: string): ModelConfig | undefined {
    return this.modelRegistry.getModel(nameOrId);
  }

  /**
   * List all available models
   */
  listModels(): ModelConfig[] {
    return this.modelRegistry.listModels();
  }

  /**
   * Get model suggestions for autocomplete
   */
  getModelSuggestions(query: string): string[] {
    return suggestModelNames(query);
  }

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
  }): ModelConfig | null {
    // If preferred model specified, use it
    if (task.preferredModel) {
      const model = this.getModel(task.preferredModel);
      if (model) return model;
    }

    // Use active model if available
    const activeModel = this.getActiveModel();
    if (activeModel && this.checkModelCapabilities(activeModel, task)) {
      return activeModel;
    }

    // Auto-select based on task requirements
    return this.autoSelectModel(task);
  }

  /**
   * Auto-select best model for task
   */
  private autoSelectModel(task: {
    requiresVision: boolean;
    requiresTools: boolean;
    maxTokens: number;
    budget?: number;
  }): ModelConfig | null {
    const models = this.modelRegistry.listModels();
    let candidates = models;

    // Filter by capabilities
    if (task.requiresVision) {
      candidates = candidates.filter(m => m.supportsVision);
    }
    if (task.requiresTools) {
      candidates = candidates.filter(m => m.supportsTools);
    }

    // Filter by max tokens
    candidates = candidates.filter(m => m.maxTokens >= task.maxTokens);

    // Filter by budget
    if (task.budget) {
      candidates = candidates.filter(m => {
        const estimatedCost = (task.prompt.length / 1000) * m.costPer1KInput;
        return estimatedCost <= task.budget;
      });
    }

    // Sort by priority (cost efficiency)
    candidates.sort((a, b) => {
      const costA = a.costPer1KInput + a.costPer1KOutput;
      const costB = b.costPer1KInput + b.costPer1KOutput;
      return costA - costB;
    });

    return candidates[0] || null;
  }

  /**
   * Check if model meets task requirements
   */
  private checkModelCapabilities(model: ModelConfig, task: {
    requiresVision: boolean;
    requiresTools: boolean;
    maxTokens: number;
  }): boolean {
    if (task.requiresVision && !model.supportsVision) return false;
    if (task.requiresTools && !model.supportsTools) return false;
    if (model.maxTokens < task.maxTokens) return false;
    return true;
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey: string): boolean {
    for (const [hash, data] of this.apiKeys) {
      if (data.key === apiKey) {
        return true;
      }
    }
    return false;
  }

  /**
   * Add API key
   */
  addApiKey(apiKey: string, quota: number = 1000000): string {
    const hash = this.hashApiKey(apiKey);
    this.apiKeys.set(hash, {
      hash,
      key: apiKey,
      createdAt: new Date(),
      quota
    });
    return hash;
  }

  /**
   * Remove API key
   */
  removeApiKey(apiKey: string): boolean {
    const hash = this.hashApiKey(apiKey);
    return this.apiKeys.delete(hash);
  }

  /**
   * Record request for billing
   */
  recordRequest(stats: Omit<RequestStats, 'timestamp' | 'modelName'> & { modelName?: string }): void {
    const model = this.getActiveModel();
    this.stats.push({
      ...stats,
      modelName: model?.displayName || stats.modelName || 'unknown',
      timestamp: new Date()
    });

    // Clean old stats (keep last 24h)
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    this.stats = this.stats.filter(s => s.timestamp > cutoff);
  }

  /**
   * Get dashboard stats
   */
  getStats(timeRange: 'hour' | 'day' | 'week' = 'day'): DashboardStats {
    const now = new Date();
    let cutoff: Date;

    switch (timeRange) {
      case 'hour':
        cutoff = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'week':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const recentStats = this.stats.filter(s => s.timestamp > cutoff);
    const totalTokens = recentStats.reduce((sum, s) => sum + s.tokensUsed, 0);
    const totalCost = recentStats.reduce((sum, s) => sum + s.cost, 0);

    return {
      totalTasks: recentStats.length,
      activeAgents: this.apiKeys.size,
      apiCallsToday: recentStats.filter(s => {
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return s.timestamp > dayAgo;
      }).length,
      tokensUsedToday: totalTokens,
      costToday: totalCost
    };
  }

  /**
   * Get switch history
   */
  getSwitchHistory(limit = 20): ModelSwitchEvent[] {
    return this.modelRegistry.getSwitchHistory(limit);
  }

  /**
   * Middleware for Express
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['authorization']?.toString().replace('Bearer ', '') || '';
      
      if (!this.validateApiKey(apiKey)) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Add model switching headers
      const activeModel = this.getActiveModel();
      if (activeModel) {
        res.set('X-Active-Model', activeModel.id);
        res.set('X-Active-Model-Name', activeModel.displayName);
      }

      next();
    };
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(apiKey: string): string {
    return Buffer.from(apiKey).toString('base64').slice(0, 32);
  }

  /**
   * Import models from JSON
   */
  importModelsFromJSON(json: string): { imported: number; errors: string[] } {
    return this.modelRegistry.registerModelsFromJSON(json);
  }

  /**
   * Get model registry
   */
  getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  /**
   * Export all configuration
   */
  exportConfiguration(): string {
    return this.modelRegistry.exportConfig();
  }

  /**
   * Import configuration
   */
  importConfiguration(json: string): { imported: number; errors: string[] } {
    return this.modelRegistry.importConfig(json);
  }
}

// ============================================
// Gateway Factory
// ============================================
export function createGateway(config: GatewayConfigExtended): SmartRouter {
  const router = new SmartRouter(config);
  router.initialize();
  return router;
}

/**
 * Create default gateway config with model registry
 */
export function createDefaultGatewayConfig(): GatewayConfigExtended {
  const modelRegistry = createModelRegistry();
  
  return {
    port: 3000,
    apiKeys: [],
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      maxConcurrent: 10
    },
    billing: {
      enabled: true,
      currency: 'USD',
      freeQuota: 100000
    },
    models: Array.from(modelRegistry.models.values()),
    providers: Array.from(modelRegistry.providers.values()),
    modelRegistry
  };
}
