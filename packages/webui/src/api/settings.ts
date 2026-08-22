import { apiClient, unwrapResponse } from './client';
import type { SettingsResponse, SettingsSchemaResponse, Settings } from './types';

/**
 * Settings API Client
 */

export const settingsApi = {
  /**
   * Get all settings (sensitive fields are masked)
   */
  get: async (): Promise<Settings> => {
    const response = await apiClient.get<{ success: true; data: SettingsResponse }>('/settings');
    return unwrapResponse(response);
  },

  /**
   * Get settings schema (for validation and UI rendering)
   */
  getSchema: async (): Promise<SettingsSchemaResponse> => {
    const response = await apiClient.get<{ success: true; data: SettingsSchemaResponse }>('/settings/schema');
    return unwrapResponse(response);
  },

  /**
   * Update settings (partial update)
   */
  update: async (settings: Partial<Settings>): Promise<Settings> => {
    const response = await apiClient.put<{ success: true; data: Settings }>('/settings', settings);
    return unwrapResponse(response);
  },
};
