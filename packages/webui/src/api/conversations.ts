import { apiClient, unwrapResponse } from './client';
import type {
  ConversationsListResponse,
  ConversationDetail,
  Conversation,
  CreateConversationRequest,
  SendMessageRequest,
  SendMessageResponse,
} from './types';

/**
 * Conversations API Client
 */

export const conversationsApi = {
  /**
   * List conversations with filtering and pagination
   */
  list: async (params?: {
    page?: number;
    pageSize?: number;
    mode?: string;
    search?: string;
    archived?: boolean;
  }): Promise<ConversationsListResponse> => {
    const response = await apiClient.get<{ success: true; data: ConversationsListResponse }>('/conversations', {
      params,
    });
    return unwrapResponse(response);
  },

  /**
   * Get conversation detail with messages
   */
  get: async (id: string, params?: {
    includeMessages?: boolean;
    messageLimit?: number;
    beforeMessageId?: string;
  }): Promise<ConversationDetail> => {
    const response = await apiClient.get<{ success: true; data: ConversationDetail }>(`/conversations/${id}`, {
      params,
    });
    return unwrapResponse(response);
  },

  /**
   * Create new conversation
   */
  create: async (data: CreateConversationRequest): Promise<Conversation> => {
    const response = await apiClient.post<{ success: true; data: Conversation }>('/conversations', data);
    return unwrapResponse(response);
  },

  /**
   * Update conversation
   */
  update: async (id: string, data: Partial<Conversation>): Promise<Conversation> => {
    const response = await apiClient.put<{ success: true; data: Conversation }>(`/conversations/${id}`, data);
    return unwrapResponse(response);
  },

  /**
   * Delete conversation
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/conversations/${id}`);
  },

  /**
   * Send message (returns taskId for SSE streaming)
   * After Lot 4 P1-2, generate=true returns 202 + taskId
   */
  sendMessage: async (conversationId: string, data: SendMessageRequest): Promise<SendMessageResponse> => {
    const response = await apiClient.post<{ success: true; data: SendMessageResponse }>(
      `/conversations/${conversationId}/messages`,
      data
    );
    return unwrapResponse(response);
  },

  /**
   * Save message without generation (for task results)
   */
  saveMessage: async (conversationId: string, data: SendMessageRequest): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/messages`, {
      ...data,
      generate: false,
    });
  },

  /**
   * Regenerate last message (returns taskId)
   */
  regenerate: async (conversationId: string, modelId?: string): Promise<SendMessageResponse> => {
    const response = await apiClient.post<{ success: true; data: SendMessageResponse }>(
      `/conversations/${conversationId}/regenerate`,
      { modelId }
    );
    return unwrapResponse(response);
  },

  /**
   * Edit message (returns taskId)
   */
  editMessage: async (
    conversationId: string,
    messageId: string,
    content: string,
    modelId?: string
  ): Promise<SendMessageResponse> => {
    const response = await apiClient.post<{ success: true; data: SendMessageResponse }>(
      `/conversations/${conversationId}/messages/${messageId}/edit`,
      { content, modelId }
    );
    return unwrapResponse(response);
  },

  /**
   * Send feedback for a message
   */
  sendFeedback: async (
    conversationId: string,
    messageId: string,
    feedback: 'like' | 'dislike'
  ): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/messages/${messageId}/feedback`, {
      feedback,
    });
  },

  /**
   * Get conversation prompt suggestions
   */
  getSuggestions: async (mode: string): Promise<{ prompts: string[] }> => {
    const response = await apiClient.get<{ success: true; data: { prompts: string[] } }>(
      '/conversations/suggestions/prompts',
      { params: { mode } }
    );
    return unwrapResponse(response);
  },
};
