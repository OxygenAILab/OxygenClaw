import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../api/conversations';
import type {
  Conversation,
  CreateConversationRequest,
  SendMessageRequest,
} from '../../../api/types';

/**
 * Query keys for conversations
 */
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
};

/**
 * List conversations with filtering and pagination
 */
export function useConversations(params?: {
  page?: number;
  pageSize?: number;
  mode?: string;
  search?: string;
  archived?: boolean;
}) {
  return useQuery({
    queryKey: conversationKeys.list(params || {}),
    queryFn: () => conversationsApi.list(params),
  });
}

/**
 * Get conversation detail with messages
 */
export function useConversation(
  id: string | null,
  options?: {
    includeMessages?: boolean;
    messageLimit?: number;
    beforeMessageId?: string;
  }
) {
  return useQuery({
    queryKey: conversationKeys.detail(id || ''),
    queryFn: () => conversationsApi.get(id!, options),
    enabled: !!id,
  });
}

/**
 * Create new conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateConversationRequest) => conversationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

/**
 * Update conversation
 */
export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Conversation> }) =>
      conversationsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

/**
 * Delete conversation
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => conversationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

/**
 * Send message (returns taskId for SSE streaming)
 * After Lot 4 P1-2, generate=true returns 202 + taskId
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, data }: { conversationId: string; data: SendMessageRequest }) =>
      conversationsApi.sendMessage(conversationId, data),
    onSuccess: (_, variables) => {
      // Invalidate conversation detail to refresh messages
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.conversationId) });
    },
  });
}

/**
 * Regenerate last message (returns taskId)
 */
export function useRegenerateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, modelId }: { conversationId: string; modelId?: string }) =>
      conversationsApi.regenerate(conversationId, modelId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.conversationId) });
    },
  });
}

/**
 * Edit message (returns taskId)
 */
export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      messageId,
      content,
      modelId,
    }: {
      conversationId: string;
      messageId: string;
      content: string;
      modelId?: string;
    }) => conversationsApi.editMessage(conversationId, messageId, content, modelId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.conversationId) });
    },
  });
}

/**
 * Send feedback for a message
 */
export function useSendFeedback() {
  return useMutation({
    mutationFn: ({
      conversationId,
      messageId,
      feedback,
    }: {
      conversationId: string;
      messageId: string;
      feedback: 'like' | 'dislike';
    }) => conversationsApi.sendFeedback(conversationId, messageId, feedback),
  });
}
