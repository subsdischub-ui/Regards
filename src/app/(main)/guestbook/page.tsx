'use client';

import { useEffect, useRef, useState } from 'react';

type Message = {
  id: string;
  audioUrl: string;
  duration: number | null;
  createdAt: string;
  guest: { id: string; name: string; avatarUrl: string | null } | null;
};

const MAX_SECONDS = 120;

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GuestbookPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function loadMessages() {
    fetch('/api/guestbook')
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  useEffect(() => {
    loadMessages();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Enregistrement audio non supporté par ce navigateur.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        blobRef.current = blob;
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordedUrl(null);
      blobRef.current = null;
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= MAX_SECONDS) stopRecording();
          return e + 1;
        });
      }, 1000);
    } catch {
      setError("Micro inaccessible — autorisez l'accès au microphone.");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function discard() {
    setRecordedUrl(null);
    blobRef.current = null;
    setElapsed(0);
  }

  async function upload() {
    if (!blobRef.current) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('audio', blobRef.current, 'message.webm');
      fd.append('duration', String(elapsed));
      const res = await fetch('/api/guestbook', { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      discard();
      loadMessages();
    } catch {
      setError("Échec de l'envoi du message.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="font-serif text-[17px] font-medium">Livre d&apos;or sonore</h1>
        <p className="text-[11px] text-text-secondary">
          Laissez un message vocal aux mariés
        </p>
      </div>

      {/* Recorder */}
      <div className="p-4">
        <div className="rounded-card bg-bg-secondary p-5 text-center">
          {!recordedUrl ? (
            <>
              <p className="mb-4 text-sm text-text-secondary">
                {recording
                  ? `Enregistrement… ${fmt(elapsed)}`
                  : 'Appuyez pour enregistrer votre message (2 min max)'}
              </p>
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
                  recording ? 'bg-accent' : 'bg-primary'
                }`}
                aria-label={recording ? 'Arrêter' : 'Enregistrer'}
              >
                {recording ? (
                  <span className="h-6 w-6 rounded bg-white" />
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
                  </svg>
                )}
              </button>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-text-secondary">Réécoutez votre message</p>
              <audio src={recordedUrl} controls className="mx-auto mb-4 w-full" />
              <div className="flex justify-center gap-3">
                <button
                  onClick={upload}
                  disabled={uploading}
                  className="rounded-lg bg-primary px-5 py-2 text-sm text-white disabled:opacity-50"
                >
                  {uploading ? 'Envoi…' : 'Envoyer aux mariés'}
                </button>
                <button
                  onClick={discard}
                  disabled={uploading}
                  className="rounded-lg border border-border px-5 py-2 text-sm disabled:opacity-50"
                >
                  Recommencer
                </button>
              </div>
            </>
          )}
          {error && <p className="mt-3 text-sm text-accent">{error}</p>}
        </div>
      </div>

      {/* Messages list */}
      <div className="space-y-3 px-4 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {messages.length} message{messages.length > 1 ? 's' : ''}
        </p>
        {messages.map((m) => (
          <div key={m.id} className="rounded-card bg-bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-secondary text-xs font-medium">
                {m.guest?.name?.charAt(0) || '?'}
              </div>
              <span className="text-[13px] font-medium">{m.guest?.name || 'Invité'}</span>
              {m.duration != null && (
                <span className="text-[11px] text-text-tertiary">{fmt(m.duration)}</span>
              )}
            </div>
            <audio src={`/api/media/file/${m.audioUrl}`} controls className="w-full" />
          </div>
        ))}
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-text-tertiary">
            Aucun message pour l&apos;instant — soyez le premier !
          </p>
        )}
      </div>
    </div>
  );
}
