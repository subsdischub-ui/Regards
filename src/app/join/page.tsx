'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const RELATIONS = [
  { value: 'ami_mariee', label: 'Ami(e) de la mariée' },
  { value: 'famille_marie', label: 'Famille du marié' },
  { value: 'famille_mariee', label: 'Famille de la mariée' },
  { value: 'ami_marie', label: 'Ami(e) du marié' },
  { value: 'collegue', label: 'Collègue' },
  { value: 'autre', label: 'Autre' },
];

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), relation }),
      });

      if (res.ok) {
        // Cookie is set server-side, also store in localStorage as fallback
        const guest = await res.json();
        localStorage.setItem('guest_id', guest.id);
        localStorage.setItem('guest_name', guest.name);
        router.push('/feed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <button onClick={() => router.back()} className="text-lg text-text-secondary">
          &larr;
        </button>
        <h1 className="text-base font-medium">Qui êtes-vous ?</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 px-6 pt-6">
          {/* Name */}
          <div>
            <label className="mb-2 block text-[13px] text-text-secondary">Votre prénom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sophie"
              className="w-full rounded-lg border border-border bg-white px-4 py-3 text-[15px] outline-none focus:border-primary"
              required
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

          {/* Selfie placeholder — will be enhanced later */}
          <div>
            <label className="mb-2 block text-[13px] text-text-secondary">
              Votre selfie{' '}
              <span className="text-text-tertiary">(optionnel)</span>
            </label>
            <div className="flex items-center gap-3.5 rounded-lg bg-bg-secondary p-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-secondary/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9A8872" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Prendre un selfie</p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Optionnel &middot; aide les autres à vous identifier
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full rounded-lg bg-primary py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Chargement...' : "C'est parti !"}
          </button>
        </div>
      </form>
    </div>
  );
}