'use client';

import { useEffect, useRef, useState } from 'react';
import { RELATIONS } from '@/lib/relations';

export default function ProfilePage() {
  const [guest, setGuest] = useState<any>(null);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/guests/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (!g) return;
        setGuest(g);
        setName(g.name ?? '');
        setRelation(g.relation ?? '');
      });
  }, []);

  function flashStatus(s: 'saved' | 'error') {
    setStatus(s);
    setTimeout(() => setStatus('idle'), 2500);
  }

  async function handleAvatar(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/guests/me/avatar', { method: 'POST', body: form });
      if (res.ok) {
        setGuest(await res.json());
        flashStatus('saved');
      } else {
        flashStatus('error');
      }
    } catch {
      flashStatus('error');
    } finally {
      setAvatarUploading(false);
      // Allow re-selecting the same file
      if (selfieInputRef.current) selfieInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/guests/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), relation: relation || null }),
      });
      if (res.ok) {
        const g = await res.json();
        setGuest(g);
        // Keep the localStorage fallback (set at /join) in sync
        localStorage.setItem('guest_name', g.name);
        flashStatus('saved');
      } else {
        flashStatus('error');
      }
    } catch {
      flashStatus('error');
    } finally {
      setSaving(false);
    }
  }

  if (!guest) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-tertiary">
        Chargement...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Mon profil</h1>
        {status === 'saved' && <span className="text-[11px] text-primary">Enregistré ✓</span>}
        {status === 'error' && <span className="text-[11px] text-red-600">Erreur, réessayez</span>}
      </div>

      <div className="flex-1 space-y-6 px-6 pt-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-bg-secondary">
            {avatarUploading ? (
              <span className="text-xs text-text-tertiary">Envoi...</span>
            ) : guest.avatarUrl ? (
              <img
                src={`/api/media/file/${guest.avatarUrl}`}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-medium text-text-secondary">
                {(name || guest.name || '?').charAt(0)}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => selfieInputRef.current?.click()}
              disabled={avatarUploading}
              className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Prendre un selfie
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={avatarUploading}
              className="rounded-full border border-border px-4 py-2 text-[13px] text-text-secondary disabled:opacity-50"
            >
              Galerie
            </button>
          </div>

          {/* capture="user" opens the FRONT camera on mobile — that is the
              selfie camera, unlike capture="environment" used for media upload */}
          <input
            ref={selfieInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={(e) => handleAvatar(e.target.files)}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleAvatar(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Name */}
        <div>
          <label className="mb-2 block text-[13px] text-text-secondary">Votre prénom</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Sophie"
            className="w-full rounded-lg border border-border bg-white px-4 py-3 text-[15px] outline-none focus:border-primary"
          />
        </div>

        {/* Relation */}
        <div>
          <label className="mb-2 block text-[13px] text-text-secondary">
            Votre lien avec les mariés
          </label>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRelation(r.value)}
                className={`rounded-full px-3.5 py-2 text-[13px] transition-colors ${
                  relation === r.value
                    ? 'bg-primary text-white'
                    : 'border border-border text-text-secondary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 pt-4">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="w-full rounded-lg bg-primary py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
