'use client';

import { useEffect, useState } from 'react';
import { useSSE } from '@/hooks/use-sse';

type SlideMedia = {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileType: string;
  caption: string | null;
  guest: { name: string } | null;
  reactionCount?: number;
};

const ADVANCE_MS = 6000;

export default function SlideshowPage() {
  const [items, setItems] = useState<SlideMedia[]>([]);
  const [index, setIndex] = useState(0);

  // Initial load — flatten clusters into a single media list.
  useEffect(() => {
    fetch('/api/media?limit=60')
      .then((r) => r.json())
      .then((data) => {
        const flat: SlideMedia[] = [];
        for (const f of data.feed ?? []) {
          if (f.type === 'cluster') flat.push(...f.items);
          else flat.push(f.item);
        }
        setItems(flat);
      })
      .catch(() => {});
  }, []);

  // Auto-advance.
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ADVANCE_MS);
    return () => clearInterval(t);
  }, [items.length]);

  // Live updates — show the freshly uploaded photo immediately.
  useSSE({
    new_media: (data: SlideMedia) => {
      setItems((prev) => {
        if (!data?.id || prev.some((p) => p.id === data.id)) return prev;
        return [data, ...prev];
      });
      setIndex(0);
    },
  });

  if (items.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0d0d0d] text-center">
        <p className="font-serif text-4xl text-[#C4A882]">Malachie &amp; Jessica</p>
        <p className="mt-4 text-lg text-white/50">En attente des premières photos…</p>
      </div>
    );
  }

  const current = items[index] ?? items[0];
  const isVideo = current.fileType?.startsWith('video/');
  const src = isVideo
    ? `/api/media/file/${current.thumbnailUrl || current.fileUrl}`
    : `/api/media/file/${current.fileUrl}`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d0d0d]">
      <style>{`@keyframes regardsFade{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:scale(1)}}`}</style>

      <img
        key={current.id}
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
        style={{ animation: 'regardsFade 1s ease' }}
      />

      {/* Monogram */}
      <div className="absolute left-8 top-6 font-serif text-2xl text-white/85 drop-shadow-lg">
        Malachie &amp; Jessica
      </div>

      {/* Progress dots */}
      <div className="absolute right-8 top-8 text-sm text-white/60 drop-shadow-lg">
        {index + 1} / {items.length}
      </div>

      {/* Caption overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            {current.guest?.name && (
              <p className="text-xl font-medium text-white drop-shadow">
                {current.guest.name}
              </p>
            )}
            {current.caption && (
              <p className="mt-1 max-w-2xl text-lg text-white/80 drop-shadow">
                {current.caption}
              </p>
            )}
          </div>
          {!!current.reactionCount && current.reactionCount > 0 && (
            <p className="flex items-center gap-2 text-xl text-white drop-shadow">
              <span style={{ color: '#E24B4A' }}>♥</span> {current.reactionCount}
            </p>
          )}
        </div>
      </div>

      {isVideo && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-full bg-black/50 p-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
