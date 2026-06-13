'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactionButton from '@/components/reaction-button';
import DownloadButton from '@/components/download-button';
import CommentThread from '@/components/comment-thread';
import { useGuest } from '@/hooks/use-guest';
import { getNeighbors, setReturnTarget, clearFeed, mediaHref } from '@/lib/feed-cache';

function formatHour(iso: string) {
  return new Date(iso)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h');
}

export default function MediaDetailPage() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const router = useRouter();
  const { guestId } = useGuest();
  const [media, setMedia] = useState<any>(null);
  const [moments, setMoments] = useState<any[]>([]);
  const [momentStatus, setMomentStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [deleting, setDeleting] = useState(false);
  const [neighbors, setNeighbors] = useState<{ prevId?: string; nextId?: string }>({});

  // Which context opened this media (?ctx=all | guest:<id> | moment:<id>). Read
  // once from the URL; it stays constant while arrowing within the same context.
  const [cacheKey] = useState<string>(() =>
    typeof window === 'undefined'
      ? 'all'
      : new URLSearchParams(window.location.search).get('ctx') || 'all'
  );

  useEffect(() => {
    fetch(`/api/media/${mediaId}`).then((r) => r.json()).then(setMedia);
  }, [mediaId]);

  // Anchor the feed's return scroll to the media currently shown, and compute
  // the ‹ › neighbors from the cached feed order. Re-runs as you arrow.
  useEffect(() => {
    setReturnTarget(cacheKey, mediaId);
    setNeighbors(getNeighbors(cacheKey, mediaId));
  }, [mediaId, cacheKey]);

  function goToNeighbor(id?: string) {
    if (!id) return;
    // replace, not push: the back button returns straight to the originating
    // list (scrolled to where you stopped), not through every media stepped past.
    router.replace(mediaHref(id, cacheKey));
  }

  // Swipe left → next, swipe right → previous. This is the primary navigation on
  // mobile (the arrows are a desktop/affordance fallback). Horizontal-dominant
  // gestures only, so vertical scrolling on the comments panel isn't hijacked.
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) goToNeighbor(neighbors.nextId);
    else goToNeighbor(neighbors.prevId);
  }

  // The localStorage check only decides what UI to show; the API re-checks
  // ownership via the httpOnly cookie on every PATCH/DELETE.
  const isOwner = Boolean(guestId && media?.guestId === guestId);

  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/moments?lite=1').then((r) => r.json()).then(setMoments);
  }, [isOwner]);

  if (!media) return <div className="flex min-h-screen items-center justify-center text-text-tertiary">Chargement...</div>;

  const isVideo = media.fileType?.startsWith('video/');
  const time = media.takenAt
    ? new Date(media.takenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  async function handleMomentChange(momentId: string) {
    setMedia((prev: any) => ({ ...prev, momentId: momentId || null }));
    setMomentStatus('saving');
    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: momentId || null }),
      });
      setMomentStatus(res.ok ? 'saved' : 'error');
    } catch {
      setMomentStatus('error');
    }
    setTimeout(() => setMomentStatus('idle'), 2500);
  }

  async function handleDelete() {
    if (!window.confirm('Supprimer définitivement cette photo ?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${mediaId}`, { method: 'DELETE' });
      if (res.ok) {
        // The cached feed still lists this (now-deleted) media; drop it so the
        // feed reloads fresh instead of restoring a phantom card.
        clearFeed(cacheKey);
        router.push('/feed');
        return;
      }
    } catch {}
    setDeleting(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 bg-black/80 px-4 py-3">
        <button onClick={() => router.back()} className="text-lg text-white">&larr;</button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-medium text-white">
            {media.guest?.name?.charAt(0)}
          </div>
          <span className="text-sm font-medium text-white">{media.guest?.name}</span>
          <span className="text-xs text-white/60">{time}</span>
        </div>
      </div>

      {/* Media */}
      <div
        className="relative flex flex-1 items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {isVideo ? (
          // poster shows the thumbnail instantly; preload="metadata" fetches
          // only the header (not the whole file — wedding clips can be 100s of
          // MB) so opening is fast. The bytes stream on play, via Range.
          <video
            src={`/api/media/file/${media.fileUrl}`}
            poster={media.thumbnailUrl ? `/api/media/file/${media.thumbnailUrl}` : undefined}
            preload="metadata"
            controls
            playsInline
            className="max-h-[70vh] w-full object-contain"
          />
        ) : (
          // Display the thumbnail (≈800px, ~150KB) instead of the full original
          // (up to several MB) — sharp enough on phones and near-instant. The
          // full-resolution file stays available via the download button.
          <img
            src={`/api/media/file/${media.thumbnailUrl || media.fileUrl}`}
            alt=""
            className="max-h-[70vh] w-full object-contain"
          />
        )}

        {/* Prev / next within the originating feed */}
        {neighbors.prevId && (
          <button
            onClick={() => goToNeighbor(neighbors.prevId)}
            aria-label="Média précédent"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white active:bg-black/60"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {neighbors.nextId && (
          <button
            onClick={() => goToNeighbor(neighbors.nextId)}
            aria-label="Média suivant"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white active:bg-black/60"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Actions + Comments */}
      <div className="rounded-t-2xl bg-white p-4">
        <div className="mb-3 flex items-center gap-4">
          <ReactionButton
            mediaId={mediaId}
            initialCount={media.reactionCount ?? 0}
            initialReacted={media.hasReacted ?? false}
          />
          <div className="ml-auto text-text-secondary">
            <DownloadButton fileUrl={media.fileUrl} />
          </div>
        </div>

        {media.caption && (
          <p className="mb-3 text-[13px] text-text-secondary">
            <span className="font-medium text-text">{media.guest?.name}</span>{' '}{media.caption}
          </p>
        )}

        {/* Owner controls */}
        {isOwner && (
          <div className="mb-4 rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium">Ma photo</p>
              {momentStatus === 'saving' && (
                <span className="text-[11px] text-text-tertiary">Enregistrement...</span>
              )}
              {momentStatus === 'saved' && (
                <span className="text-[11px] text-primary">Moment mis à jour ✓</span>
              )}
              {momentStatus === 'error' && (
                <span className="text-[11px] text-red-600">Erreur, réessayez</span>
              )}
            </div>

            <label className="mb-1.5 block text-[12px] text-text-secondary">
              Moment du mariage
            </label>
            <select
              value={media.momentId ?? ''}
              onChange={(e) => handleMomentChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="">Automatique (selon l&apos;heure de la photo)</option>
              {moments.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({formatHour(m.startTime)} &ndash; {formatHour(m.endTime)})
                </option>
              ))}
            </select>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="mt-3 text-[13px] font-medium text-red-600 disabled:opacity-50"
            >
              {deleting ? 'Suppression...' : 'Supprimer cette photo'}
            </button>
          </div>
        )}

        <CommentThread mediaId={mediaId} />
      </div>
    </div>
  );
}
