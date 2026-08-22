import { apiClient, unwrapResponse } from './client';
import type { HealthResponse } from './types';

/**
 * Health & System API Client
 */

export const healthApi = {
  /**
   * Check system health
   */
  check: async (): Promise<HealthResponse> => {
    const response = await apiClient.get<{ success: true; data: HealthResponse }>('/health');
    return unwrapResponse(response);
  },
};
