'use client';

export default function DownloadButton({ fileUrl }: { fileUrl: string }) {
  return (
    <a
      href={`/api/media/file/${fileUrl}?download=true`}
      className="flex items-center gap-1"
      download
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </a>
  );
}