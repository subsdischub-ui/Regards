'use client';

import { useState } from 'react';

type FileWithCaption = {
  file: File;
  preview: string;
  caption: string;
};

export default function UploadPreview({
  files,
  onCaptionChange,
  onRemove,
}: {
  files: FileWithCaption[];
  onCaptionChange: (index: number, caption: string) => void;
  onRemove: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (files.length === 0) return null;

  const active = files[activeIndex];

  return (
    <div>
      {/* Main preview */}
      <div className="relative aspect-square overflow-hidden rounded-card bg-bg-secondary">
        {active.file.type.startsWith('video/') ? (
          <video src={active.preview} className="h-full w-full object-cover" />
        ) : (
          <img src={active.preview} alt="" className="h-full w-full object-cover" />
        )}
        <button
          onClick={() => onRemove(activeIndex)}
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
        onChange={(e) => onCaptionChange(activeIndex, e.target.value)}
        placeholder="Ajouter un commentaire..."
        className="mt-3 w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
      />

      {/* Thumbnails strip */}
      {files.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                i === activeIndex ? 'border-primary' : 'border-transparent'
              }`}
            >
              <img src={f.preview} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}