// src/hooks/useWebSocketWithReconnect.ts
import { useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketOptions {
  url: string;
  onMessage?: (msg: any) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onFailedReconnect?: () => void;
  shouldMonitorConnection?: boolean;
  dependencies?: any[];
}

export default function useWebSocketWithReconnect(options: WebSocketOptions) {
  const {
    url,
    onMessage,
    onClose = () => {},
    onError = () => {},
    onFailedReconnect = () => {},
    shouldMonitorConnection = true,
    dependencies = [],
  } = options || {};

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectTime = 60000; // 1 minute max reconnect limit

  const retryStartTimeRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(true);

  const connect = () => {
    if (!isActiveRef.current) return;
    setConnectionStatus('connecting');
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      if (!isActiveRef.current) return;
      console.log('[WS] Connected');
      setConnectionStatus('connected');
      reconnectAttempts.current = 0; // Reset attempts on successful connection
      retryStartTimeRef.current = null;
    };

    wsRef.current.onmessage = (event) => {
      if (!isActiveRef.current) return;
      try {
        const message = JSON.parse(event.data);
        onMessage?.(message);
      } catch (error) {
        console.error('[WS] Error parsing message:', error);
      }
    };

    wsRef.current.onclose = (event) => {
      if (!isActiveRef.current) return;
      console.log('[WS] Disconnected:', event.reason);
      setConnectionStatus('disconnected');

      if (shouldMonitorConnection) {
        onClose(event);
      }

      const now = Date.now();
      if (!retryStartTimeRef.current) {
        retryStartTimeRef.current = now;
      }

      const elapsed = now - (retryStartTimeRef.current || 0);

      if (elapsed < maxReconnectTime) {
        // TWEAK: Exponential Backoff (1s, 2s, 4s, 8s, capped at 10s)
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
        
        console.log(`[WS] Reconnecting in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        console.warn('[WS] Reconnect limit reached');
        onFailedReconnect();
      }
    };

    wsRef.current.onerror = (error) => {
      if (!isActiveRef.current) return;
      console.error('[WS] Error:', error);
      setConnectionStatus('error');
      if (shouldMonitorConnection) {
        onError(error);
      }
    };
  };

  useEffect(() => {
    isActiveRef.current = true;
    connect();
    return () => {
      isActiveRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...dependencies]);

  return { connectionStatus };
}
