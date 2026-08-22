import { useQuery } from '@tanstack/react-query';
import { modelsApi } from '../../../api/models';

/**
 * Query keys for models
 */
export const modelKeys = {
  all: ['models'] as const,
  lists: () => [...modelKeys.all, 'list'] as const,
  list: () => [...modelKeys.lists()] as const,
  details: () => [...modelKeys.all, 'detail'] as const,
  detail: (id: string) => [...modelKeys.details(), id] as const,
};

/**
 * List all enabled models
 */
export function useModels() {
  return useQuery({
    queryKey: modelKeys.list(),
    queryFn: () => modelsApi.list(),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Get model by ID
 */
export function useModel(modelId: string | null) {
  return useQuery({
    queryKey: modelKeys.detail(modelId || ''),
    queryFn: () => modelsApi.getById(modelId!),
    enabled: !!modelId,
    staleTime: 60_000,
  });
}
