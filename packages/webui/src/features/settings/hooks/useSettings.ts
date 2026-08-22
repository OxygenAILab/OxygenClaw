import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../api/settings';
import type { Settings } from '../../../api/types';

/**
 * Query keys for settings
 */
export const settingsKeys = {
  all: ['settings'] as const,
  lists: () => [...settingsKeys.all, 'list'] as const,
  list: () => [...settingsKeys.lists()] as const,
  schemas: () => [...settingsKeys.all, 'schema'] as const,
  schema: () => [...settingsKeys.schemas()] as const,
};

/**
 * Get all settings
 */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.list(),
    queryFn: () => settingsApi.get(),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Get settings schema
 */
export function useSettingsSchema() {
  return useQuery({
    queryKey: settingsKeys.schema(),
    queryFn: () => settingsApi.getSchema(),
    staleTime: 300_000, // 5 minutes
  });
}

/**
 * Update settings
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<Settings>) => settingsApi.update(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.list() });
    },
  });
}
