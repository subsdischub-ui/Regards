import Link from 'next/link';
import ReactionButton from './reaction-button';
import DownloadButton from './download-button';
import { mediaHref } from '@/lib/feed-cache';

type Props = {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileType: string;
  caption: string | null;
  challengeId: string | null;
  guest: { id: string; name: string; avatarUrl: string | null } | null;
  takenAt: string | null;
  width?: number | null;
  height?: number | null;
  reactionCount?: number;
  commentCount?: number;
  hasReacted?: boolean;
  // The context key this card belongs to ('all', 'guest:<id>'...). Threaded
  // into the media link so the detail view can offer ‹ › arrows and restore scroll.
  feedContext?: string;
};

export default function MediaCard({
  id,
  fileUrl,
  thumbnailUrl,
  fileType,
  caption,
  challengeId,
  guest,
  takenAt,
  width,
  height,
  reactionCount = 0,
  commentCount = 0,
  hasReacted = false,
  feedContext,
}: Props) {
  const displayUrl = thumbnailUrl || fileUrl;
  const time = takenAt ? new Date(takenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  const isVideo = fileType.startsWith('video/');
  const href = mediaHref(id, feedContext);

  return (
    <div className="bg-bg-card rounded-card overflow-hidden" data-testid="media-card" data-media-id={id}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Link href={`/feed?guest=${guest?.id}`}>
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-bg-secondary text-xs font-medium">
            {guest?.avatarUrl ? (
              <img
                src={`/api/media/file/${guest.avatarUrl}`}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              guest?.name?.charAt(0) || '?'
            )}
          </div>
        </Link>
        <span className="text-[13px] font-medium">{guest?.name}</span>
        <span className="text-[11px] text-text-tertiary">{time}</span>
      </div>

      {/* Media — Link is block so its children get the card width (an inline
          <a> would collapse a width:100% child to 0). */}
      <Link href={href} className="block">
        {isVideo ? (
          <div className="relative aspect-video bg-bg-secondary">
            <img src={`/api/media/file/${displayUrl}`} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/40 p-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </div>
            </div>
          </div>
        ) : (
          // aspect-ratio on the <img> itself (a replaced element, sized
          // reliably against the card) reserves its space before the lazy
          // image loads — keeps feed height stable so scroll restoration lands
          // on the right media — without wrapping it in a block div.
          <img
            src={`/api/media/file/${displayUrl}`}
            alt=""
            className="w-full object-cover"
            style={{ aspectRatio: width && height ? `${width} / ${height}` : undefined }}
            loading="lazy"
          />
        )}
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-3 px-4 py-2">
        <ReactionButton mediaId={id} initialCount={reactionCount} initialReacted={hasReacted} />
        <Link href={href} className="flex items-center gap-1 text-text-tertiary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs text-text-secondary" data-testid="comment-count">{commentCount}</span>
        </Link>
        <div className="ml-auto text-text-tertiary">
          <DownloadButton fileUrl={fileUrl} />
        </div>
        {challengeId && (
          <div className="flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-[11px] font-medium text-secondary">Défi</span>
          </div>
        )}
      </div>

      {/* Caption */}
      {caption && (
        <p className="px-4 pb-3 text-[13px] leading-relaxed text-text-secondary">
          <span className="font-medium text-text">{guest?.name}</span>{' '}{caption}
        </p>
      )}
    </div>
  );
}
