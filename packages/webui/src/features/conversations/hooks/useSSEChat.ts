import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { runtimeApi } from '../../../api/runtime';
import { conversationKeys } from './useConversations';
import type { RuntimeEvent } from '../../../api/types';

interface UseSSEChatOptions {
  conversationId: string;
  onEvent?: (event: RuntimeEvent) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface UseSSEChatResult {
  isStreaming: boolean;
  error: Error | null;
  events: RuntimeEvent[];
  startStreaming: (taskId: string, afterSeq?: number) => void;
  stopStreaming: () => void;
}

/**
 * SSE chat hook for streaming assistant responses
 * Handles 202 + taskId pattern from Lot 4 P1-2 backend changes
 */
export function useSSEChat(options: UseSSEChatOptions): UseSSEChatResult {
  const { conversationId, onEvent, onComplete, onError } = options;
  const queryClient = useQueryClient();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [events, setEvents] = useState<RuntimeEvent[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const taskIdRef = useRef<string | null>(null);
  const lastSeqRef = useRef(0);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setIsStreaming(false);
    reconnectCountRef.current = 0;
    taskIdRef.current = null;
    lastSeqRef.current = 0;
  }, []);

  const startStreaming = useCallback(
    (taskId: string, afterSeq = 0) => {
      stopStreaming();

      taskIdRef.current = taskId;
      lastSeqRef.current = afterSeq;
      setError(null);
      setIsStreaming(true);
      if (afterSeq === 0) {
        setEvents([]);
      }

      const url = runtimeApi.buildLiveEventsUrl(taskId, afterSeq);
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        reconnectCountRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        // [DONE] signal terminates the stream
        if (event.data === '[DONE]') {
          stopStreaming();
          queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
          onComplete?.();
          return;
        }

        try {
          const runtimeEvent = JSON.parse(event.data) as RuntimeEvent;

          // Track highest seq for reconnection
          if (runtimeEvent.seq > lastSeqRef.current) {
            lastSeqRef.current = runtimeEvent.seq;
          }

          setEvents((prev) => [...prev, runtimeEvent]);
          onEvent?.(runtimeEvent);

          // Invalidate on terminal events
          if (
            runtimeEvent.type === 'task_complete' ||
            runtimeEvent.type === 'task_error' ||
            runtimeEvent.type === 'task_cancelled'
          ) {
            queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
          }
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      eventSource.onerror = () => {
        const error = new Error('SSE connection error');
        setError(error);
        eventSource.close();

        // Exponential backoff reconnection (max 30s)
        const delay = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 30_000);
        reconnectCountRef.current += 1;

        if (reconnectCountRef.current <= 5 && taskIdRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            console.log(`Reconnecting SSE (attempt ${reconnectCountRef.current}, afterSeq=${lastSeqRef.current})...`);
            startStreaming(taskIdRef.current!, lastSeqRef.current);
          }, delay);
        } else {
          setIsStreaming(false);
          onError?.(error);
        }
      };
    },
    [conversationId, queryClient, onEvent, onComplete, onError, stopStreaming]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    isStreaming,
    error,
    events,
    startStreaming,
    stopStreaming,
  };
}
