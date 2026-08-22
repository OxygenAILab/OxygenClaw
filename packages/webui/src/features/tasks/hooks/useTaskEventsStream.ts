import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { runtimeApi } from '../../../api/runtime';
import { taskKeys } from './useTasks';
import type { RuntimeEvent } from '../../../api/types';

interface UseTaskEventsStreamOptions {
  taskId: string;
  onEvent?: (event: RuntimeEvent) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface UseTaskEventsStreamResult {
  isStreaming: boolean;
  error: Error | null;
  events: RuntimeEvent[];
  startStreaming: (afterSeq?: number) => void;
  stopStreaming: () => void;
}

/**
 * SSE hook for streaming task events
 * Similar to useSSEChat but for generic runtime tasks
 */
export function useTaskEventsStream(options: UseTaskEventsStreamOptions): UseTaskEventsStreamResult {
  const { taskId, onEvent, onComplete, onError } = options;
  const queryClient = useQueryClient();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [events, setEvents] = useState<RuntimeEvent[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
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
    lastSeqRef.current = 0;
  }, []);

  const startStreaming = useCallback(
    (afterSeq = 0) => {
      stopStreaming();

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
          queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
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
            queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
            queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
          }
        } catch {
          console.error('Failed to parse SSE event');
        }
      };

      eventSource.onerror = () => {
        const error = new Error('SSE connection error');
        setError(error);
        eventSource.close();

        // Exponential backoff reconnection (max 30s)
        const delay = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 30_000);
        reconnectCountRef.current += 1;

        if (reconnectCountRef.current <= 5) {
          reconnectTimerRef.current = setTimeout(() => {
            console.log(`Reconnecting task events SSE (attempt ${reconnectCountRef.current}, afterSeq=${lastSeqRef.current})...`);
            startStreaming(lastSeqRef.current);
          }, delay);
        } else {
          setIsStreaming(false);
          onError?.(error);
        }
      };
    },
    [taskId, queryClient, onEvent, onComplete, onError, stopStreaming]
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
