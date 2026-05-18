'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UploadPreview from '@/components/upload-preview';

type FileWithCaption = { file: File; preview: string; caption: string };

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileWithCaption[]>([]);
  const [challengeId, setChallengeId] = useState('');
  const [challenges, setChallenges] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/challenges')
      .then((r) => r.json())
      .then((data) => setChallenges(data.filter((c: any) => c.isActive && !c.completed)));
  }, []);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const additions = Array.from(newFiles).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: '',
    }));
    setFiles((prev) => [...prev, ...additions]);
  }

  function handleCaptionChange(index: number, caption: string) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, caption } : f)));
  }

  function handleRemove(index: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);

    const guestId = localStorage.getItem('guest_id') || '';
    let uploaded = 0;

    for (const f of files) {
      try {
        // Use tus upload
        const { Upload } = await import('tus-js-client');

        await new Promise<void>((resolve, reject) => {
          const upload = new Upload(f.file, {
            // Path segment 'files' is required: the catch-all route at
            // [...path]/route.ts demands ≥1 path segment, and Next.js
            // 308-redirects '/api/upload/tus/' → '/api/upload/tus' (no slash)
            // which then 404s. Hitting '/api/upload/tus/files' matches the
            // catch-all (path=['files']) and reaches the TUS handler. The
            // 'files' label is arbitrary and not interpreted server-side.
            endpoint: '/api/upload/tus/files',
            retryDelays: [0, 1000, 3000, 5000],
            metadata: {
              filename: f.file.name,
              filetype: f.file.type,
              guest_id: guestId,
              caption: f.caption || '',
              challenge_id: challengeId || '',
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              const fileProgress = (bytesUploaded / bytesTotal) * 100;
              const totalProgress = ((uploaded * 100 + fileProgress) / files.length);
              setProgress(Math.round(totalProgress));
            },
            onSuccess: () => {
              uploaded++;
              resolve();
            },
            onError: (error) => {
              console.error('Upload error:', error);
              reject(error);
            },
          });

          upload.start();
        });
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    setUploading(false);
    router.push('/feed');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Partager</h1>
      </div>

      <div className="flex-1 space-y-4 p-5">
        {files.length === 0 ? (
          <div className="space-y-3">
            {/* Camera */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-card bg-primary/10 p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium">Prendre une photo</p>
                <p className="text-xs text-text-secondary">Ouvrir la caméra</p>
              </div>
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            {/* Gallery */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-card border border-border p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium">Choisir depuis la galerie</p>
                <p className="text-xs text-text-secondary">Photos et vidéos</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>
        ) : (
          <>
            <UploadPreview
              files={files}
              onCaptionChange={handleCaptionChange}
              onRemove={handleRemove}
            />

            {/* Challenge selector */}
            {challenges.length > 0 && (
              <div>
                <label className="mb-2 block text-[13px] text-text-secondary">
                  Défi (optionnel)
                </label>
                <select
                  value={challengeId}
                  onChange={(e) => setChallengeId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none"
                >
                  <option value="">Aucun défi</option>
                  {challenges.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.title} (+{c.points} pts)</option>
                  ))}
                </select>
              </div>
            )}

            {/* Add more */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-primary"
            >
              + Ajouter d'autres fichiers
            </button>
          </>
        )}
      </div>

      {/* Submit */}
      {files.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          {uploading && (
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full rounded-lg bg-primary py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {uploading ? `Envoi en cours... ${progress}%` : `Envoyer ${files.length} fichier${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}