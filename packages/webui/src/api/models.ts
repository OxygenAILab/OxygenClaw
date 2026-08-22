import { apiClient, unwrapResponse } from './client';
import type { ModelsResponse, Model } from './types';

/**
 * Models API Client
 */

export const modelsApi = {
  /**
   * List all enabled models
   */
  list: async (): Promise<ModelsResponse> => {
    const response = await apiClient.get<{ success: true; data: ModelsResponse }>('/llm/models');
    return unwrapResponse(response);
  },

  /**
   * Get model by ID
   */
  getById: async (modelId: string): Promise<Model | null> => {
    const { models } = await modelsApi.list();
    return models.find((m) => m.id === modelId) || null;
  },
};
