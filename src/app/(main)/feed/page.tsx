'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useInfiniteFeed } from '@/hooks/use-infinite-feed';
import { feedCacheKey } from '@/lib/feed-cache';
import { useSSE } from '@/hooks/use-sse';
import Link from 'next/link';
import MediaCard from '@/components/media-card';
import ClusterCard from '@/components/cluster-card';
import AvatarRow from '@/components/avatar-row';

import { Suspense } from "react";

function FeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const guestFilter = searchParams.get('guest') ?? undefined;
  const { items, loading, hasMore, loadMore, prepend, restoredTarget, consumeTarget } =
    useInfiniteFeed(guestFilter);
  const [guests, setGuests] = useState<any[]>([]);
  const observerRef = useRef<HTMLDivElement>(null);

  // Load guests for avatar row
  useEffect(() => {
    fetch('/api/guests').then((r) => r.json()).then(setGuests);
  }, []);

  // Initial load + reset on filter change is handled inside useInfiniteFeed.

  // Returning from a media: scroll back to the one you were viewing instead of
  // landing at the top. Targets the element (not a pixel offset) so it's robust
  // to images still loading.
  useEffect(() => {
    if (!restoredTarget || items.length === 0) return;
    const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(restoredTarget) : restoredTarget;
    const el = document.querySelector(`[data-media-id="${safe}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
    consumeTarget();
  }, [restoredTarget, items.length, consumeTarget]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  // SSE for new media
  useSSE({
    new_media: (data: any) => {
      if (!guestFilter) {
        prepend({ type: 'single', item: data });
      }
    },
  });

  function handleGuestSelect(id: string | null) {
    if (id) {
      router.push(`/feed?guest=${id}`);
    } else {
      router.push('/feed');
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h1 className="font-serif text-[17px] font-medium">Regards</h1>
          <p className="text-[11px] text-primary">
            {guests.length} regards &middot; {items.length} photos
          </p>
        </div>
        <Link href="/profile" aria-label="Mon profil" className="p-1 text-text-secondary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>
      </div>

      {/* Avatar row */}
      <AvatarRow
        guests={guests}
        activeGuestId={guestFilter ?? null}
        onSelect={handleGuestSelect}
      />

      {/* Feed */}
      <div className="space-y-3 p-4">
        {items.map((item, i) => {
          if (item.type === 'cluster') {
            return (
              <ClusterCard
                key={`cluster-${i}`}
                items={item.items}
                time={item.time}
                feedContext={feedCacheKey(guestFilter)}
              />
            );
          }
          const m = item.item;
          return (
            <MediaCard
              key={m.id}
              id={m.id}
              fileUrl={m.fileUrl}
              thumbnailUrl={m.thumbnailUrl}
              fileType={m.fileType}
              caption={m.caption}
              challengeId={m.challengeId}
              guest={m.guest}
              takenAt={m.takenAt}
              width={m.width}
              height={m.height}
              reactionCount={m.reactionCount}
              commentCount={m.commentCount}
              hasReacted={m.hasReacted}
              feedContext={guestFilter}
            />
          );
        })}

        {loading && <p className="text-center text-sm text-text-tertiary">Chargement...</p>}

        <div ref={observerRef} className="h-4" />
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <FeedContent />
    </Suspense>
  );
}


