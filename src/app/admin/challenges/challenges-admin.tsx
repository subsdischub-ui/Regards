'use client';

import { useState } from 'react';
import Link from 'next/link';

type Challenge = {
  id: string;
  title: string;
  description: string;
  points: number;
  unlockAt: string | null;
  sortOrder: number;
  isActive: boolean;
};

type FormState = {
  id: string | null;
  title: string;
  description: string;
  points: string;
  unlockAt: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  title: '',
  description: '',
  points: '30',
  unlockAt: '',
  sortOrder: '0',
  isActive: true,
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ChallengesAdmin({ initial }: { initial: Challenge[] }) {
  const [list, setList] = useState<Challenge[]>(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function startCreate() {
    setForm(EMPTY_FORM);
    setError('');
  }

  function startEdit(c: Challenge) {
    setForm({
      id: c.id,
      title: c.title,
      description: c.description,
      points: String(c.points),
      unlockAt: toLocalInput(c.unlockAt),
      sortOrder: String(c.sortOrder),
      isActive: c.isActive,
    });
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Titre et description requis.');
      return;
    }
    setBusy(true);
    setError('');

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      points: Number(form.points) || 0,
      sortOrder: Number(form.sortOrder) || 0,
      unlockAt: form.unlockAt || null,
      isActive: form.isActive,
    };

    try {
      const res = form.id
        ? await fetch(`/api/challenges/${form.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/challenges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error('Échec de l\'enregistrement');
      const saved = await res.json();
      const normalized: Challenge = {
        id: saved.id,
        title: saved.title,
        description: saved.description,
        points: saved.points,
        unlockAt: saved.unlockAt ? new Date(saved.unlockAt).toISOString() : null,
        sortOrder: saved.sortOrder,
        isActive: saved.isActive,
      };
      setList((prev) => {
        const next = form.id
          ? prev.map((c) => (c.id === normalized.id ? normalized : c))
          : [...prev, normalized];
        return next.sort((a, b) => a.sortOrder - b.sortOrder);
      });
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce défi ?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/challenges/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Échec de la suppression');
      setList((prev) => prev.filter((c) => c.id !== id));
      if (form.id === id) setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-text-secondary">&larr; Dashboard</Link>
        <h1 className="font-serif text-2xl">Gérer les défis</h1>
      </div>

      {/* Form */}
      <form onSubmit={save} className="mb-8 space-y-3 rounded-card bg-bg-secondary p-4">
        <h2 className="font-medium">{form.id ? 'Modifier le défi' : 'Nouveau défi'}</h2>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Titre"
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description"
          rows={2}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-text-secondary">
            Points
            <input
              type="number"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-xs text-text-secondary">
            Ordre d'affichage
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
        <label className="block text-xs text-text-secondary">
          Déverrouillage (vide = toujours actif)
          <input
            type="datetime-local"
            value={form.unlockAt}
            onChange={(e) => setForm({ ...form, unlockAt: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Actif
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {form.id ? 'Enregistrer' : 'Créer'}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {/* List */}
      <div className="space-y-2">
        {list.map((c) => (
          <div key={c.id} className="rounded-card border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {c.sortOrder}. {c.title}{' '}
                  <span className="text-xs text-primary">+{c.points} pts</span>
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">{c.description}</p>
                <p className="mt-1 text-[11px] text-text-tertiary">
                  {c.isActive ? 'Actif' : 'Verrouillé'}
                  {c.unlockAt
                    ? ` · déverrouillage ${new Date(c.unlockAt).toLocaleString('fr-FR')}`
                    : ''}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <button
                  onClick={() => startEdit(c)}
                  className="rounded-lg border border-border px-3 py-1 text-xs"
                >
                  Éditer
                </button>
                <button
                  onClick={() => remove(c.id)}
                  disabled={busy}
                  className="rounded-lg border border-accent px-3 py-1 text-xs text-accent disabled:opacity-50"
                >
                  Suppr.
                </button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-center text-sm text-text-tertiary">Aucun défi.</p>
        )}
      </div>
    </div>
  );
}
