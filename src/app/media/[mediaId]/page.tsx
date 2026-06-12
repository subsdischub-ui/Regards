'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactionButton from '@/components/reaction-button';
import DownloadButton from '@/components/download-button';
import CommentThread from '@/components/comment-thread';
import { useGuest } from '@/hooks/use-guest';

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

  useEffect(() => {
    fetch(`/api/media/${mediaId}`).then((r) => r.json()).then(setMedia);
  }, [mediaId]);

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
      <div className="flex flex-1 items-center justify-center">
        {isVideo ? (
          <video
            src={`/api/media/file/${media.fileUrl}`}
            controls
            className="max-h-[70vh] w-full object-contain"
          />
        ) : (
          <img
            src={`/api/media/file/${media.fileUrl}`}
            alt=""
            className="max-h-[70vh] w-full object-contain"
          />
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
