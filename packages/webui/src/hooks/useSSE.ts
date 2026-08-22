import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * SSE Connection State
 */
export type SSEState = 'connecting' | 'open' | 'closed' | 'error';

/**
 * SSE Event Handler
 */
export type SSEEventHandler<T = unknown> = (event: T) => void;

/**
 * SSE Hook Options
 */
export interface UseSSEOptions<T = unknown> {
  url: string;
  enabled?: boolean;
  onMessage?: SSEEventHandler<T>;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * SSE Hook Return Value
 */
export interface UseSSEResult<T = unknown> {
  state: SSEState;
  error: Event | null;
  lastMessage: T | null;
  reconnectCount: number;
  close: () => void;
}

/**
 * Generic SSE Hook with automatic reconnection
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection state tracking
 * - Error handling
 * - Clean cleanup on unmount
 *
 * @example
 * const { state, lastMessage } = useSSE<ChatChunk>({
 *   url: '/api/conversations/123/messages',
 *   onMessage: (chunk) => {
 *     if (chunk.choices?.[0]?.delta?.content) {
 *       appendContent(chunk.choices[0].delta.content);
 *     }
 *   },
 * });
 */
export function useSSE<T = unknown>(options: UseSSEOptions<T>): UseSSEResult<T> {
  const {
    url,
    enabled = true,
    onMessage,
    onError,
    onOpen,
    onClose,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [state, setState] = useState<SSEState>('closed');
  const [error, setError] = useState<Event | null>(null);
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setState('closed');
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !isMountedRef.current) return;

    close();

    setState('connecting');
    setError(null);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!isMountedRef.current) return;
      setState('open');
      setReconnectCount(0);
      onOpen?.();
    };

    eventSource.onmessage = (event) => {
      if (!isMountedRef.current) return;

      // Check for [DONE] signal
      if (event.data === '[DONE]') {
        close();
        onClose?.();
        return;
      }

      try {
        const parsed = JSON.parse(event.data) as T;
        setLastMessage(parsed);
        onMessage?.(parsed);
      } catch (err) {
        console.error('[useSSE] Failed to parse message:', err);
      }
    };

    eventSource.onerror = (err) => {
      if (!isMountedRef.current) return;

      setState('error');
      setError(err);
      onError?.(err);

      eventSource.close();
      eventSourceRef.current = null;

      // Attempt reconnection
      if (reconnect && reconnectCount < maxReconnectAttempts) {
        const delay = Math.min(
          reconnectInterval * Math.pow(2, reconnectCount),
          30000
        );
        console.log(`[useSSE] Reconnecting in ${delay}ms (attempt ${reconnectCount + 1}/${maxReconnectAttempts})`);

        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          setReconnectCount((prev) => prev + 1);
          connect();
        }, delay);
      } else {
        setState('closed');
        onClose?.();
      }
    };
  }, [url, enabled, reconnect, reconnectCount, maxReconnectAttempts, reconnectInterval, onMessage, onError, onOpen, onClose, close]);

  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      close();
    };
  }, [enabled, connect, close]);

  return {
    state,
    error,
    lastMessage,
    reconnectCount,
    close,
  };
}
