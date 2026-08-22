import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { runtimeApi } from '../../../api/runtime';
import type {
  StartAgentTaskRequest,
  StartComputerUseRequest,
} from '../../../api/types';

/**
 * Query keys for runtime tasks
 */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (userId?: string) => [...taskKeys.lists(), { userId }] as const,
  recent: (limit: number) => [...taskKeys.all, 'recent', limit] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  events: (id: string, afterSeq: number) => [...taskKeys.detail(id), 'events', afterSeq] as const,
};

/**
 * List all runtime tasks
 */
export function useTasks(userId?: string) {
  return useQuery({
    queryKey: taskKeys.list(userId),
    queryFn: () => runtimeApi.listTasks(userId),
  });
}

/**
 * Get recent tasks (limited)
 */
export function useRecentTasks(limit = 10) {
  return useQuery({
    queryKey: taskKeys.recent(limit),
    queryFn: () => runtimeApi.getRecentTasks(limit),
  });
}

/**
 * Get task detail with events and worker runs
 */
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(taskId || ''),
    queryFn: () => runtimeApi.getTask(taskId!),
    enabled: !!taskId,
  });
}

/**
 * Get task events (with optional incremental fetch)
 */
export function useTaskEvents(taskId: string | null, afterSeq = 0) {
  return useQuery({
    queryKey: taskKeys.events(taskId || '', afterSeq),
    queryFn: () => runtimeApi.getEvents(taskId!, afterSeq),
    enabled: !!taskId,
  });
}

/**
 * Start agent task
 */
export function useStartAgentTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StartAgentTaskRequest) => runtimeApi.startAgentTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Start ComputerUse task
 */
export function useStartComputerUse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StartComputerUseRequest) => runtimeApi.startComputerUse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Cancel running task
 */
export function useCancelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => runtimeApi.cancelTask(taskId),
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Delete task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => runtimeApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
