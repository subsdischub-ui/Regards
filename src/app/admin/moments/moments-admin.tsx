'use client';

import { useState } from 'react';
import Link from 'next/link';

type Moment = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
};

type FormState = {
  id: string | null;
  label: string;
  startTime: string;
  endTime: string;
};

const EMPTY_FORM: FormState = { id: null, label: '', startTime: '', endTime: '' };

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MomentsAdmin({ initial }: { initial: Moment[] }) {
  const [list, setList] = useState<Moment[]>(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function startCreate() {
    setForm(EMPTY_FORM);
    setError('');
  }

  function startEdit(m: Moment) {
    setForm({
      id: m.id,
      label: m.label,
      startTime: toLocalInput(m.startTime),
      endTime: toLocalInput(m.endTime),
    });
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startTime || !form.endTime) {
      setError('Heure de début et de fin requises.');
      return;
    }
    if (new Date(form.startTime) >= new Date(form.endTime)) {
      setError('La fin doit être après le début.');
      return;
    }
    setBusy(true);
    setError('');

    const payload = {
      label: form.label.trim(),
      startTime: form.startTime,
      endTime: form.endTime,
    };

    try {
      const res = form.id
        ? await fetch(`/api/moments/${form.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/moments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error('Échec de l\'enregistrement');
      const saved = await res.json();
      const normalized: Moment = {
        id: saved.id,
        label: saved.label ?? '',
        startTime: new Date(saved.startTime).toISOString(),
        endTime: new Date(saved.endTime).toISOString(),
      };
      setList((prev) => {
        const next = form.id
          ? prev.map((m) => (m.id === normalized.id ? normalized : m))
          : [...prev, normalized];
        return next.sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
      });
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce moment ?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/moments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Échec de la suppression');
      setList((prev) => prev.filter((m) => m.id !== id));
      if (form.id === id) setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-text-secondary">&larr; Dashboard</Link>
        <h1 className="font-serif text-2xl">Gérer les moments</h1>
      </div>

      {/* Form */}
      <form onSubmit={save} className="mb-8 space-y-3 rounded-card bg-bg-secondary p-4">
        <h2 className="font-medium">{form.id ? 'Modifier le moment' : 'Nouveau moment'}</h2>
        <input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Label (ex. Cérémonie)"
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-text-secondary">
            Début
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-xs text-text-secondary">
            Fin
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
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
        {list.map((m) => (
          <div key={m.id} className="rounded-card border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{m.label || '(sans label)'}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {fmt(m.startTime)} &rarr; {fmt(m.endTime)}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <button
                  onClick={() => startEdit(m)}
                  className="rounded-lg border border-border px-3 py-1 text-xs"
                >
                  Éditer
                </button>
                <button
                  onClick={() => remove(m.id)}
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
          <p className="text-center text-sm text-text-tertiary">Aucun moment.</p>
        )}
      </div>
    </div>
  );
}
