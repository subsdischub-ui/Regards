'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { mediaHref, saveFeed, loadFeed, clearReturnTarget } from '@/lib/feed-cache';

function fmtHour(iso: string) {
  return new Date(iso)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h');
}

export default function MomentDetailPage() {
  const { momentId } = useParams<{ momentId: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const cacheKey = `moment:${momentId}`;

  useEffect(() => {
    fetch(`/api/moments/${momentId}/media`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [momentId]);

  // Persist the moment's ordered ids so the media view's ‹ › arrows walk this
  // moment (saveFeed preserves any pending return target).
  useEffect(() => {
    if (!data?.items) return;
    saveFeed(cacheKey, {
      items: [],
      cursor: null,
      hasMore: false,
      orderedIds: data.items.map((m: any) => m.id),
    });
  }, [data, cacheKey]);

  // Returning from a media opened here: scroll back to it instead of the top.
  useEffect(() => {
    if (!data?.items?.length) return;
    const cached = loadFeed(cacheKey);
    if (!cached?.returnTargetId) return;
    const safe =
      typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(cached.returnTargetId)
        : cached.returnTargetId;
    const el = document.querySelector(`[data-media-id="${safe}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
    clearReturnTarget(cacheKey);
  }, [data, cacheKey]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-tertiary">
        Chargement...
      </div>
    );
  }

  const { moment, items } = data;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <button onClick={() => router.back()} aria-label="Retour" className="text-lg text-text-secondary">
          &larr;
        </button>
        <div>
          <h1 className="text-base font-medium">{moment.label || 'Moment'}</h1>
          <p className="text-[11px] text-text-tertiary">
            {fmtHour(moment.startTime)} &ndash; {fmtHour(moment.endTime)} &middot; {items.length}{' '}
            {items.length > 1 ? 'médias' : 'média'}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-text-tertiary">
          Aucun média sur ce moment pour l&apos;instant.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 p-1.5">
          {items.map((m: any) => (
            <Link
              key={m.id}
              href={mediaHref(m.id, cacheKey)}
              data-media-id={m.id}
              className="relative aspect-square overflow-hidden rounded-lg bg-bg-secondary"
            >
              <img
                src={`/api/media/file/${m.thumbnailUrl || m.fileUrl}`}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {m.fileType?.startsWith('video/') && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-black/40 p-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
              )}
              <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[9px] text-white">
                {m.guestName}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
