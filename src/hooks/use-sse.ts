'use client';

import { useEffect, useRef, useCallback } from 'react';

type SSEHandler = (data: any) => void;

export function useSSE(handlers: Record<string, SSEHandler>) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const guestId = localStorage.getItem('guest_id') || '';
    const es = new EventSource(`/api/sse?guest_id=${guestId}`);
    eventSourceRef.current = es;

    for (const event of Object.keys(handlersRef.current)) {
      es.addEventListener(event, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current[event]?.(data);
        } catch {}
      });
    }

    es.onerror = () => {
      // EventSource auto-reconnects, nothing to do
    };

    return () => {
      es.close();
    };
  }, []);

  return eventSourceRef;
}