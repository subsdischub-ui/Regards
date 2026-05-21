'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactionButton from '@/components/reaction-button';
import DownloadButton from '@/components/download-button';
import CommentThread from '@/components/comment-thread';

export default function MediaDetailPage() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const router = useRouter();
  const [media, setMedia] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/media/${mediaId}`).then((r) => r.json()).then(setMedia);
  }, [mediaId]);

  if (!media) return <div className="flex min-h-screen items-center justify-center text-text-tertiary">Chargement...</div>;

  const isVideo = media.fileType?.startsWith('video/');
  const time = media.takenAt
    ? new Date(media.takenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

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

        <CommentThread mediaId={mediaId} />
      </div>
    </div>
  );
}