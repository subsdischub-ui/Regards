'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { isTestGuestName } from '@/lib/moderation';

type Guest = {
  id: string;
  name: string;
  relation: string | null;
  avatarUrl: string | null;
  points: number;
  createdAt: string;
  mediaCount: number;
};

export default function GuestsAdmin({ initial }: { initial: Guest[] }) {
  const [list, setList] = useState<Guest[]>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const testCount = useMemo(
    () => list.filter((g) => isTestGuestName(g.name)).length,
    [list]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectTestAccounts() {
    setSelected(new Set(list.filter((g) => isTestGuestName(g.name)).map((g) => g.id)));
  }

  async function deleteOne(id: string): Promise<boolean> {
    const res = await fetch(`/api/admin/guests/${id}`, { method: 'DELETE' });
    return res.ok;
  }

  async function removeSingle(guest: Guest) {
    if (
      !confirm(
        `Supprimer « ${guest.name} » ?\n\n${guest.mediaCount} média(s), ses commentaires, réactions et messages audio seront définitivement supprimés.`
      )
    )
      return;
    setBusy(true);
    try {
      if (await deleteOne(guest.id)) {
        setList((prev) => prev.filter((g) => g.id !== guest.id));
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(guest.id);
          return next;
        });
      } else {
        alert('Suppression impossible.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    const targets = list.filter((g) => selected.has(g.id));
    if (targets.length === 0) return;
    const totalMedia = targets.reduce((sum, g) => sum + g.mediaCount, 0);
    if (
      !confirm(
        `Supprimer ${targets.length} invité(s) et leurs ${totalMedia} média(s) ?\n\nCette action est définitive.`
      )
    )
      return;

    setBusy(true);
    const failed: string[] = [];
    try {
      for (const guest of targets) {
        if (await deleteOne(guest.id)) {
          setList((prev) => prev.filter((g) => g.id !== guest.id));
        } else {
          failed.push(guest.name);
        }
      }
      setSelected(new Set(failed.length ? list.filter((g) => failed.includes(g.name)).map((g) => g.id) : []));
      if (failed.length) alert(`Échec pour : ${failed.join(', ')}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-text-secondary">&larr; Dashboard</Link>
        <h1 className="font-serif text-2xl">Gestion des invités</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={selectTestAccounts}
          disabled={busy || testCount === 0}
          className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          Sélectionner les comptes test ({testCount})
        </button>
        <button
          onClick={removeSelected}
          disabled={busy || selected.size === 0}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Suppression...' : `Supprimer la sélection (${selected.size})`}
        </button>
        <span className="text-sm text-text-tertiary">{list.length} invité(s)</span>
      </div>

      <div className="space-y-2">
        {list.map((guest) => {
          const isTest = isTestGuestName(guest.name);
          return (
            <div
              key={guest.id}
              className={`flex items-center gap-3 rounded-card border p-3 ${
                isTest ? 'border-accent/40 bg-accent/5' : 'border-border'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(guest.id)}
                onChange={() => toggle(guest.id)}
                disabled={busy}
                className="h-4 w-4 flex-shrink-0"
              />
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-secondary text-sm font-medium">
                {guest.avatarUrl ? (
                  <img
                    src={`/api/media/file/${guest.avatarUrl}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  guest.name.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {guest.name}
                  {isTest && (
                    <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-normal text-accent">
                      test
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-tertiary">
                  {guest.relation || 'relation inconnue'} &middot; {guest.mediaCount} média(s)
                  &middot; {guest.points} pts &middot;{' '}
                  {new Date(guest.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                onClick={() => removeSingle(guest)}
                disabled={busy}
                className="rounded border border-accent px-2 py-1 text-[11px] text-accent disabled:opacity-50"
              >
                Suppr.
              </button>
            </div>
          );
        })}
      </div>
      {list.length === 0 && (
        <p className="mt-8 text-center text-sm text-text-tertiary">Aucun invité.</p>
      )}
    </div>
  );
}
