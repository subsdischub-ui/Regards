'use client';

import { useState, useCallback, useRef } from 'react';

export function useInfiniteFeed(guestFilter?: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const params = new URLSearchParams();
    if (cursorRef.current) params.set('cursor', cursorRef.current);
    if (guestFilter) params.set('guest', guestFilter);

    const res = await fetch(`/api/media?${params}`);
    const data = await res.json();

    setItems((prev) => [...prev, ...data.feed]);
    cursorRef.current = data.nextCursor;
    setHasMore(!!data.nextCursor);
    setLoading(false);
  }, [loading, hasMore, guestFilter]);

  const prepend = useCallback((item: any) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  return { items, loading, hasMore, loadMore, prepend };
}