'use client';

import { useEffect, useRef } from 'react';

type SSEHandler = (data: any) => void;

// A single EventSource is shared across the whole tab. Previously every call
// site (ToastProvider in the main layout + the feed page) opened its own
// connection, so a guest sitting on the feed held TWO permanent SSE streams —
// each one a long-lived Node route handler and a browser connection slot. We
// now multiplex all subscribers onto one connection with refcounting.
let es: EventSource | null = null;
let refCount = 0;
const listeners = new Map<string, Set<SSEHandler>>();
const attached = new Set<string>();

function attachEvent(event: string) {
  if (!es || attached.has(event)) return;
  attached.add(event);
  es.addEventListener(event, (e: MessageEvent) => {
    let data: unknown;
    try {
      data = JSON.parse(e.data);
    } catch {
      return;
    }
    const set = listeners.get(event);
    if (set) for (const h of set) { try { h(data); } catch {} }
  });
}

function ensureConnection() {
  if (es) return;
  const guestId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('guest_id') || '' : '';
  es = new EventSource(`/api/sse?guest_id=${guestId}`);
  es.onerror = () => {
    // EventSource auto-reconnects; nothing to do.
  };
  for (const event of listeners.keys()) attachEvent(event);
}

export function useSSE(handlers: Record<string, SSEHandler>) {
  // Keep the latest handler closures so the stable wrappers always dispatch to
  // current state without re-subscribing on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    refCount++;
    const events = Object.keys(handlersRef.current);
    const wrappers: Record<string, SSEHandler> = {};
    for (const event of events) {
      const w: SSEHandler = (data) => handlersRef.current[event]?.(data);
      wrappers[event] = w;
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(w);
      ensureConnection();
      attachEvent(event);
    }

    return () => {
      for (const event of Object.keys(wrappers)) {
        const set = listeners.get(event);
        if (set) {
          set.delete(wrappers[event]);
          if (set.size === 0) listeners.delete(event);
        }
      }
      refCount--;
      if (refCount === 0 && es) {
        es.close();
        es = null;
        attached.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
