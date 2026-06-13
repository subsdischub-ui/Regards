// Client-side feed context cache (sessionStorage).
//
// Solves two feed↔media frictions:
//   1. Returning from a media re-rendered the feed from page 1, scrolled to top.
//      We persist the already-loaded feed so the return restores it and scrolls
//      back to the media you were viewing.
//   2. The media view had no notion of its surrounding feed, so you couldn't
//      step to the next/previous media without going back. We persist the
//      ordered id list of the feed context so the media page can offer ‹ › arrows.
//
// Scoped to the media↔feed round-trip via `returnTargetId`: a plain feed visit
// (no target set) always fetches fresh, so live uploads still appear.

const PREFIX = 'regards.feed.';
// Scroll offset lives under its own tiny key so persisting it on every scroll
// frame never re-serializes the (potentially large) feed item list.
const SCROLL_PREFIX = 'regards.scrollY.';
// Abandoned targets (media → elsewhere → feed much later) must not resurrect a
// stale list. Restores only happen within this window.
const FRESH_MS = 30 * 60 * 1000;

export type FeedCache = {
  items: any[];
  cursor: string | null;
  hasMore: boolean;
  orderedIds: string[];
  returnTargetId?: string;
  ts: number;
};

/** Cache key for a feed context: a guest-filtered feed or the global feed. */
export function feedCacheKey(guestFilter?: string): string {
  return guestFilter ? `guest:${guestFilter}` : 'all';
}

/**
 * Build the media link carrying its originating context (global feed, a guest
 * feed, or a moment) so the detail view restores scroll and offers ‹ › arrows.
 * The context key is the full cache key — e.g. 'all', 'guest:<id>', 'moment:<id>'.
 */
export function mediaHref(mediaId: string, contextKey?: string): string {
  return `/media/${mediaId}?ctx=${encodeURIComponent(contextKey || 'all')}`;
}

/**
 * Flatten feed items into the media ids in display order — standalone `single`
 * items plus every member of a `cluster`, in the order they're rendered. This
 * is the sequence the ‹ › arrows walk, so it matches what scrolling would show.
 */
export function flattenFeedIds(items: any[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (it?.type === 'single') {
      if (it.item?.id) out.push(it.item.id);
    } else if (it?.type === 'cluster' && Array.isArray(it.items)) {
      for (const m of it.items) if (m?.id) out.push(m.id);
    }
  }
  return out;
}

/** Pure neighbor lookup. prevId = up the feed (newer), nextId = down (older). */
export function neighborsOf(
  orderedIds: string[],
  id: string,
): { prevId?: string; nextId?: string } {
  const i = orderedIds.indexOf(id);
  if (i === -1) return {};
  return {
    prevId: i > 0 ? orderedIds[i - 1] : undefined,
    nextId: i < orderedIds.length - 1 ? orderedIds[i + 1] : undefined,
  };
}

function read(key: string): FeedCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as FeedCache) : null;
  } catch {
    return null;
  }
}

function write(key: string, data: FeedCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // Quota exceeded or serialization failure — degrade gracefully (no restore).
  }
}

/** Persist the loaded feed, preserving any pending return target. */
export function saveFeed(
  key: string,
  data: { items: any[]; cursor: string | null; hasMore: boolean; orderedIds: string[] },
): void {
  const prev = read(key);
  write(key, { ...data, returnTargetId: prev?.returnTargetId, ts: Date.now() });
}

/** Load the cached feed, ignoring stale entries past the freshness window. */
export function loadFeed(key: string): FeedCache | null {
  const c = read(key);
  if (!c) return null;
  if (Date.now() - c.ts > FRESH_MS) return null;
  return c;
}

/** Mark which media the feed should scroll back to (set while viewing it). */
export function setReturnTarget(key: string, mediaId: string): void {
  const c = read(key);
  if (!c) return; // no cached feed for this context (deep link) — nothing to anchor
  write(key, { ...c, returnTargetId: mediaId });
}

/** Consume the return target once the feed has scrolled to it. */
export function clearReturnTarget(key: string): void {
  const c = read(key);
  if (!c?.returnTargetId) return;
  const { returnTargetId, ...rest } = c;
  void returnTargetId;
  write(key, rest as FeedCache);
}

/** Persist the feed's scroll offset for an exact restore on return. */
export function saveScrollY(key: string, y: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SCROLL_PREFIX + key, String(Math.round(y)));
  } catch {
    // Quota/serialization failure — degrade to no scroll restore.
  }
}

/** Read the persisted scroll offset (null if none stored). */
export function loadScrollY(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.sessionStorage.getItem(SCROLL_PREFIX + key);
    return v != null ? parseInt(v, 10) : null;
  } catch {
    return null;
  }
}

/** Drop a context's cache entirely (e.g. after deleting a media). */
export function clearFeed(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PREFIX + key);
    window.sessionStorage.removeItem(SCROLL_PREFIX + key);
  } catch {
    // ignore
  }
}

/** Neighbors of a media within a cached feed context, for the ‹ › arrows. */
export function getNeighbors(key: string, mediaId: string): { prevId?: string; nextId?: string } {
  const c = read(key);
  if (!c) return {};
  return neighborsOf(c.orderedIds, mediaId);
}
