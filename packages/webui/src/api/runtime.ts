import { apiClient, unwrapResponse } from './client';
import type {
  RuntimeTasksResponse,
  RuntimeTaskDetailResponse,
  RuntimeEventsResponse,
  StartAgentTaskRequest,
  StartAgentTaskResponse,
  StartComputerUseRequest,
  WorkerManagerStats,
  WorkerCapability,
} from './types';

/**
 * Runtime Tasks API Client
 */

export const runtimeApi = {
  /**
   * List runtime tasks
   */
  listTasks: async (userId?: string): Promise<RuntimeTasksResponse> => {
    const response = await apiClient.get<{ success: true; data: RuntimeTasksResponse }>('/agent/tasks', {
      params: userId ? { userId } : undefined,
    });
    return unwrapResponse(response);
  },

  /**
   * Get recent tasks (limited)
   */
  getRecentTasks: async (limit = 10): Promise<RuntimeTasksResponse> => {
    const response = await apiClient.get<{ success: true; data: RuntimeTasksResponse }>('/agent/tasks/recent', {
      params: { limit },
    });
    return unwrapResponse(response);
  },

  /**
   * Get task detail with events and worker runs
   */
  getTask: async (taskId: string): Promise<RuntimeTaskDetailResponse> => {
    const response = await apiClient.get<{ success: true; data: RuntimeTaskDetailResponse }>(
      `/agent/tasks/${taskId}`
    );
    return unwrapResponse(response);
  },

  /**
   * Get task events (with optional incremental fetch)
   */
  getEvents: async (taskId: string, afterSeq = 0): Promise<RuntimeEventsResponse> => {
    const response = await apiClient.get<{ success: true; data: RuntimeEventsResponse }>(
      `/agent/tasks/${taskId}/events`,
      {
        params: afterSeq > 0 ? { afterSeq } : undefined,
      }
    );
    return unwrapResponse(response);
  },

  /**
   * Get worker runs for a task
   */
  getWorkerRuns: async (taskId: string): Promise<{ taskId: string; workerRuns: any[] }> => {
    const response = await apiClient.get<{ success: true; data: { taskId: string; workerRuns: any[] } }>(
      `/agent/tasks/${taskId}/workers`
    );
    return unwrapResponse(response);
  },

  /**
   * Start agent task (returns taskId immediately, use SSE to stream events)
   */
  startAgentTask: async (data: StartAgentTaskRequest): Promise<StartAgentTaskResponse> => {
    const response = await apiClient.post<{ success: true; data: StartAgentTaskResponse }>(
      '/agent/start',
      data
    );
    return unwrapResponse(response);
  },

  /**
   * Start ComputerUse task
   */
  startComputerUse: async (data: StartComputerUseRequest): Promise<StartAgentTaskResponse> => {
    const response = await apiClient.post<{ success: true; data: StartAgentTaskResponse }>(
      '/agent/computeruse/start',
      data
    );
    return unwrapResponse(response);
  },

  /**
   * Cancel running task
   */
  cancelTask: async (taskId: string): Promise<{ taskId: string; status: string; message: string }> => {
    const response = await apiClient.post<{
      success: true;
      data: { taskId: string; status: string; message: string };
    }>(`/agent/tasks/${taskId}/cancel`);
    return unwrapResponse(response);
  },

  /**
   * Delete task
   */
  deleteTask: async (taskId: string): Promise<void> => {
    await apiClient.delete(`/agent/tasks/${taskId}`);
  },

  /**
   * Get worker manager stats (for diagnostics)
   */
  getWorkerStats: async (): Promise<WorkerManagerStats> => {
    const response = await apiClient.get<{ success: true; data: WorkerManagerStats }>(
      '/agent/runtime/workers'
    );
    return unwrapResponse(response);
  },

  /**
   * Get worker capabilities (to determine available execution backends)
   */
  getWorkerCapabilities: async (): Promise<{ workers: WorkerCapability[] }> => {
    const response = await apiClient.get<{ success: true; data: { workers: WorkerCapability[] } }>(
      '/agent/runtime/workers/capabilities'
    );
    return unwrapResponse(response);
  },

  /**
   * Build SSE URL for live event streaming with afterSeq support
   */
  buildLiveEventsUrl: (taskId: string, afterSeq = 0): string => {
    const baseUrl = apiClient.defaults.baseURL || '';
    const token = localStorage.getItem('oxygenclaw:auth_token');
    const url = new URL(`${baseUrl}/agent/tasks/${taskId}/events/live`);

    if (afterSeq > 0) {
      url.searchParams.set('afterSeq', String(afterSeq));
    }
    if (token) {
      url.searchParams.set('token', token);
    }

    return url.toString();
  },
};
