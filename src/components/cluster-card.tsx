import Link from 'next/link';
import { mediaHref } from '@/lib/feed-cache';

type ClusterItem = {
  id: string;
  thumbnailUrl: string | null;
  fileUrl: string;
  guest: { id: string; name: string } | null;
};

export default function ClusterCard({
  items,
  time,
  feedContext,
}: {
  items: ClusterItem[];
  time: string;
  feedContext?: string;
}) {
  const displayTime = new Date(time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const main = items[0];
  const rest = items.slice(1, 3);
  const hrefFor = (id: string) => mediaHref(id, feedContext);

  return (
    <div className="rounded-card overflow-hidden bg-bg-secondary p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/20">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <span className="text-xs font-medium tracking-wide text-secondary">
          MÊME MOMENT &middot; {displayTime}
        </span>
      </div>

      {/* Grid */}
      <div className="flex gap-1.5">
        <Link href={hrefFor(main.id)} className="flex-[2]" data-media-id={main.id}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <img
              src={`/api/media/file/${main.thumbnailUrl || main.fileUrl}`}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5">
              <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-bg-secondary text-[8px] font-medium">
                {main.guest?.name?.charAt(0)}
              </div>
              <span className="text-[10px] text-white">{main.guest?.name}</span>
            </div>
          </div>
        </Link>
        <div className="flex flex-1 flex-col gap-1.5">
          {rest.map((item) => (
            <Link key={item.id} href={hrefFor(item.id)} className="flex-1" data-media-id={item.id}>
              <div className="relative h-full overflow-hidden rounded-lg">
                <img
                  src={`/api/media/file/${item.thumbnailUrl || item.fileUrl}`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-bg-secondary text-[8px] font-medium">
                  {item.guest?.name?.charAt(0)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-1.5 text-center text-[11px] text-text-tertiary">
        {items.length} regards sur ce moment
      </p>
    </div>
  );
}