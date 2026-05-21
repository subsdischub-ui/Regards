'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Item = {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileType: string;
  processingStatus: string;
  guestName: string;
};

export default function MediaAdmin({ initial }: { initial: Item[] }) {
  const [list, setList] = useState<Item[]>(initial);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const guestNames = useMemo(
    () => Array.from(new Set(list.map((i) => i.guestName))).sort(),
    [list]
  );
  const shown = filter ? list.filter((i) => i.guestName === filter) : list;

  async function remove(id: string) {
    if (!confirm('Supprimer ce média ? Cette action est définitive.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Échec');
      setList((prev) => prev.filter((i) => i.id !== id));
    } catch {
      alert('Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-text-secondary">&larr; Dashboard</Link>
        <h1 className="font-serif text-2xl">Modération des médias</h1>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">Tous les invités ({list.length})</option>
          {guestNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="text-sm text-text-tertiary">{shown.length} média(s)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((item) => {
          const src = item.thumbnailUrl
            ? `/api/media/file/${item.thumbnailUrl}`
            : `/api/media/file/${item.fileUrl}`;
          return (
            <div key={item.id} className="overflow-hidden rounded-card border border-border">
              <div className="relative aspect-square bg-bg-secondary">
                {item.processingStatus === 'done' || item.thumbnailUrl ? (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-text-tertiary">
                    {item.processingStatus}
                  </div>
                )}
                {item.fileType.startsWith('video/') && (
                  <span className="absolute right-1 top-1 rounded bg-black/50 px-1.5 text-[10px] text-white">
                    vidéo
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs text-text-secondary">{item.guestName}</span>
                <button
                  onClick={() => remove(item.id)}
                  disabled={busy}
                  className="rounded border border-accent px-2 py-0.5 text-[11px] text-accent disabled:opacity-50"
                >
                  Suppr.
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {shown.length === 0 && (
        <p className="mt-8 text-center text-sm text-text-tertiary">Aucun média.</p>
      )}
    </div>
  );
}
