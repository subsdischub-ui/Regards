'use client';

import { useState, useCallback } from 'react';
import { useSSE } from '@/hooks/use-sse';

const BADGE_ICONS: Record<string, string> = {
  'Premier regard': '\u26A1',
  'Paparazzi': '\uD83D\uDCF8',
  'Vidéaste': '\uD83C\uDFAC',
  'Social butterfly': '\uD83E\uDD8B',
  'Chasseur de défis': '\uD83C\uDFC6',
  'Noctambule': '\uD83C\uDF19',
  'Fan #1': '\u2764\uFE0F',
  'Regard d\'or': '\uD83D\uDC51',
};

type Toast = { id: number; message: string; icon: string };

export default function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, icon: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useSSE({
    badge_unlocked: (data: { badge: string }) => {
      addToast(`Badge débloqué : ${data.badge}`, BADGE_ICONS[data.badge] || '\uD83C\uDF1F');
    },
    challenge_unlocked: (data: { title: string }) => {
      addToast(`Nouveau défi : ${data.title}`, '\u2B50');
    },
  });

  return (
    <div className="fixed left-4 right-4 top-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-[slideDown_0.3s_ease-out] rounded-card bg-white px-4 py-3 shadow-lg"
        >
          <span className="mr-2">{toast.icon}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}