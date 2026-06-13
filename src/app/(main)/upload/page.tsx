'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UploadPreview from '@/components/upload-preview';

export type UploadItem = {
  id: string;
  file: File;
  preview: string;
  caption: string;
  status: 'uploading' | 'done' | 'error';
  progress: number; // 0..100
  key?: string; // S3 object key, set once the upload completes
};

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [challengeId, setChallengeId] = useState('');
  const [challenges, setChallenges] = useState<any[]>([]);
  const [momentId, setMomentId] = useState('');
  const [moments, setMoments] = useState<any[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);
  // Live tus upload handles, so a stuck file can be aborted when removed.
  const uploadsRef = useRef<Map<string, { abort: () => void }>>(new Map());

  useEffect(() => {
    fetch('/api/challenges')
      .then((r) => r.json())
      .then((data) => setChallenges(data.filter((c: any) => c.isActive && !c.completed)));
    fetch('/api/moments?lite=1')
      .then((r) => r.json())
      .then(setMoments);
  }, []);

  // Abort any in-flight uploads if the user leaves mid-transfer.
  useEffect(() => {
    const uploads = uploadsRef.current;
    return () => {
      uploads.forEach((u) => {
        try {
          u.abort();
        } catch {}
      });
      uploads.clear();
    };
  }, []);

  function formatHour(iso: string) {
    return new Date(iso)
      .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      .replace(':', 'h');
  }

  function patch(id: string, changes: Partial<UploadItem>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...changes } : f)));
  }

  // Start transferring a file's bytes to S3 immediately on add. The media row is
  // NOT created here — that happens on "Envoyer" via finalize, once all files
  // are fully uploaded.
  async function startUpload(item: UploadItem) {
    const { Upload } = await import('tus-js-client');
    const guestId = localStorage.getItem('guest_id') || '';

    const upload = new Upload(item.file, {
      // Path segment 'files' is required: the catch-all route demands ≥1 path
      // segment ('/api/upload/tus' alone 404s after Next's 308 redirect).
      endpoint: '/api/upload/tus/files',
      retryDelays: [0, 1000, 3000, 5000],
      metadata: {
        filename: item.file.name,
        filetype: item.file.type,
        guest_id: guestId,
      },
      onProgress: (sent, totalBytes) => {
        patch(item.id, { progress: totalBytes ? Math.round((sent / totalBytes) * 100) : 0 });
      },
      onSuccess: () => {
        // The S3 key is the tus upload id — the last segment of the upload URL.
        const key = upload.url ? upload.url.split('/').pop() || undefined : undefined;
        patch(item.id, { status: key ? 'done' : 'error', progress: 100, key });
        uploadsRef.current.delete(item.id);
      },
      onError: () => {
        patch(item.id, { status: 'error' });
        uploadsRef.current.delete(item.id);
      },
    });

    uploadsRef.current.set(item.id, upload);
    upload.start();
  }

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const additions: UploadItem[] = Array.from(newFiles).map((file) => ({
      id: `f${++idRef.current}`,
      file,
      preview: URL.createObjectURL(file),
      caption: '',
      status: 'uploading' as const,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...additions]);
    additions.forEach(startUpload);
  }

  function handleCaptionChange(id: string, caption: string) {
    patch(id, { caption });
  }

  function handleRemove(id: string) {
    const up = uploadsRef.current.get(id);
    if (up) {
      try {
        up.abort();
      } catch {}
      uploadsRef.current.delete(id);
    }
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  const total = files.length;
  const doneCount = files.filter((f) => f.status === 'done').length;
  const anyUploading = files.some((f) => f.status === 'uploading');
  const anyError = files.some((f) => f.status === 'error');
  const allDone = total > 0 && doneCount === total;
  const overallProgress = total
    ? Math.round(files.reduce((sum, f) => sum + (f.status === 'done' ? 100 : f.progress), 0) / total)
    : 0;

  async function handleSend() {
    if (!allDone || finalizing) return;
    setFinalizing(true);

    const guestId = localStorage.getItem('guest_id') || '';
    const items = files
      .filter((f) => f.status === 'done' && f.key)
      .map((f) => ({
        key: f.key,
        fileType: f.file.type,
        fileSize: f.file.size,
        caption: f.caption,
        challengeId: challengeId || null,
        momentId: momentId || null,
      }));

    try {
      const res = await fetch('/api/upload/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, guestId }),
      });
      if (!res.ok) throw new Error('finalize failed');
      const data = await res.json();
      const failed: string[] = data.failedKeys ?? [];

      if (failed.length === 0) {
        router.push('/feed');
        return;
      }

      // Some objects were incomplete: drop the ones that went through, keep the
      // failures flagged so the user can remove them and retry.
      setFiles((prev) => {
        const kept: UploadItem[] = [];
        for (const f of prev) {
          const sentOk = f.key && !failed.includes(f.key);
          if (sentOk) {
            URL.revokeObjectURL(f.preview);
            continue;
          }
          kept.push(f.key && failed.includes(f.key) ? { ...f, status: 'error' } : f);
        }
        return kept;
      });
      setFinalizing(false);
      alert(
        `${failed.length} fichier(s) incomplet(s) n'ont pas été envoyés. Retirez-les, puis réessayez.`
      );
    } catch {
      setFinalizing(false);
      alert("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
    }
  }

  const sendLabel = finalizing
    ? 'Envoi...'
    : anyUploading
      ? `Téléchargement... ${doneCount}/${total}`
      : anyError
        ? 'Retirez les fichiers en échec'
        : `Envoyer ${total} média${total > 1 ? 's' : ''}`;

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

            {/* Moment selector */}
            {moments.length > 0 && (
              <div>
                <label className="mb-2 block text-[13px] text-text-secondary">
                  Moment du mariage (optionnel)
                </label>
                <select
                  value={momentId}
                  onChange={(e) => setMomentId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none"
                >
                  <option value="">Automatique (selon l&apos;heure de la photo)</option>
                  {moments.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({formatHour(m.startTime)} &ndash; {formatHour(m.endTime)})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              + Ajouter d&apos;autres fichiers
            </button>
          </>
        )}
      </div>

      {/* Submit */}
      {files.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          {!allDone && (
            <>
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-text-secondary">
                <span>{doneCount}/{total} média(s) téléchargé(s)</span>
                {anyUploading && <span>{overallProgress}%</span>}
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </>
          )}
          <button
            onClick={handleSend}
            disabled={!allDone || finalizing}
            className="w-full rounded-lg bg-primary py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {sendLabel}
          </button>
        </div>
      )}
    </div>
  );
}
