'use client';

import { useState } from 'react';

type PreviewItem = {
  id: string;
  file: File;
  preview: string;
  caption: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
};

function StatusBadge({ status }: { status: PreviewItem['status'] }) {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  }
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}

export default function UploadPreview({
  files,
  onCaptionChange,
  onRemove,
}: {
  files: PreviewItem[];
  onCaptionChange: (id: string, caption: string) => void;
  onRemove: (id: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (files.length === 0) return null;

  const idx = Math.min(activeIndex, files.length - 1);
  const active = files[idx];

  return (
    <div>
      {/* Main preview */}
      <div className="relative aspect-square overflow-hidden rounded-card bg-bg-secondary">
        {active.file.type.startsWith('video/') ? (
          <video src={active.preview} className="h-full w-full object-cover" />
        ) : (
          <img src={active.preview} alt="" className="h-full w-full object-cover" />
        )}

        {/* Uploading veil + progress bar */}
        {active.status === 'uploading' && (
          <>
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute bottom-0 left-0 right-0">
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-white">
                <span>Téléchargement…</span>
                <span>{active.progress}%</span>
              </div>
              <div className="h-1.5 bg-white/25">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${active.progress}%` }}
                />
              </div>
            </div>
          </>
        )}

        {/* Error veil */}
        {active.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-900/45 px-4 text-center">
            <span className="text-sm font-medium text-white">Téléchargement échoué</span>
            <span className="text-[12px] text-white/80">Retirez ce fichier pour pouvoir envoyer.</span>
          </div>
        )}

        {/* Done check */}
        {active.status === 'done' && (
          <div className="absolute left-2 top-2">
            <StatusBadge status="done" />
          </div>
        )}

        <button
          onClick={() => onRemove(active.id)}
          aria-label="Retirer ce fichier"
          className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Caption */}
      <input
        type="text"
        value={active.caption}
        onChange={(e) => onCaptionChange(active.id, e.target.value)}
        placeholder="Ajouter un commentaire..."
        className="mt-3 w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
      />

      {/* Thumbnails strip */}
      {files.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {files.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setActiveIndex(i)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                i === idx ? 'border-primary' : 'border-transparent'
              }`}
            >
              <img src={f.preview} alt="" className="h-full w-full object-cover" />
              <span
                className={`absolute inset-0 flex items-center justify-center ${
                  f.status === 'done' ? 'bg-transparent' : 'bg-black/40'
                }`}
              >
                {f.status === 'uploading' ? (
                  <span className="text-[10px] font-medium text-white">{f.progress}%</span>
                ) : (
                  <StatusBadge status={f.status} />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
