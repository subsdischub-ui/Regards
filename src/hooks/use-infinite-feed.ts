'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  feedCacheKey,
  flattenFeedIds,
  loadFeed,
  saveFeed,
  clearReturnTarget,
} from '@/lib/feed-cache';

/**
 * Collects every media id present in the feed — both standalone `single`
 * items and the members of `cluster` items — so de-duplication also catches a
 * media that is already rendered inside a cluster.
 */
export function collectIds(items: any[]): Set<string> {
  const ids = new Set<string>();
  for (const it of items) {
    if (it?.type === 'single') {
      if (it.item?.id) ids.add(it.item.id);
    } else if (it?.type === 'cluster' && Array.isArray(it.items)) {
      for (const m of it.items) {
        if (m?.id) ids.add(m.id);
      }
    }
  }
  return ids;
}

export function useInfiniteFeed(guestFilter?: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // When set, the feed was restored after returning from a media: the page
  // should scroll this media into view (then call consumeTarget).
  const [restoredTarget, setRestoredTarget] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  // Synchronous guard against concurrent fetches (StrictMode double effects,
  // fast scroll) appending the same page twice.
  const inFlightRef = useRef(false);
  // Generation token: a fetch started for an older filter must not overwrite
  // results for the current one.
  const genRef = useRef(0);

  async function fetchPage(gen: number, cursor: string | null) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (guestFilter) params.set('guest', guestFilter);

      const res = await fetch(`/api/media?${params}`);
      const data = await res.json();
      if (gen !== genRef.current) return; // stale filter — discard

      setItems((prev) => {
        const base = cursor ? prev : [];
        const seen = collectIds(base);
        const fresh = (data.feed ?? []).filter((it: any) =>
          it?.type === 'single' ? !seen.has(it.item?.id) : true
        );
        return [...base, ...fresh];
      });
      cursorRef.current = data.nextCursor;
      setHasMore(!!data.nextCursor);
    } finally {
      // Only the fetch belonging to the current generation may release the
      // guard. A stale fetch finishing late must not unlock a newer in-flight
      // request — that would let a concurrent loadMore() append a duplicate page.
      if (gen === genRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }

  // Reset and reload whenever the guest filter changes — unless we are returning
  // from a media in this same context, in which case restore the cached feed so
  // the scroll position (and the media you were on) is preserved.
  useEffect(() => {
    const gen = ++genRef.current;
    inFlightRef.current = false;

    const cached = loadFeed(feedCacheKey(guestFilter));
    if (cached?.returnTargetId) {
      cursorRef.current = cached.cursor;
      setItems(cached.items);
      setHasMore(cached.hasMore);
      setRestoredTarget(cached.returnTargetId);
      return;
    }

    setRestoredTarget(null);
    cursorRef.current = null;
    setItems([]);
    setHasMore(true);
    fetchPage(gen, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestFilter]);

  // Persist the loaded feed so a later return can restore it. saveFeed preserves
  // any pending returnTargetId, so this never clobbers the scroll anchor.
  useEffect(() => {
    if (items.length === 0) return;
    saveFeed(feedCacheKey(guestFilter), {
      items,
      cursor: cursorRef.current,
      hasMore,
      orderedIds: flattenFeedIds(items),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, hasMore, guestFilter]);

  const loadMore = useCallback(() => {
    if (!hasMore || inFlightRef.current) return;
    fetchPage(genRef.current, cursorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore]);

  const prepend = useCallback((item: any) => {
    setItems((prev) => {
      if (item?.type === 'single' && collectIds(prev).has(item.item?.id)) {
        return prev;
      }
      return [item, ...prev];
    });
  }, []);

  // Called by the feed page once it has scrolled the restored media into view.
  const consumeTarget = useCallback(() => {
    setRestoredTarget(null);
    clearReturnTarget(feedCacheKey(guestFilter));
  }, [guestFilter]);

  return { items, loading, hasMore, loadMore, prepend, restoredTarget, consumeTarget };
}
