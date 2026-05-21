'use client';

import { useState } from 'react';

export default function ReactionButton({
  mediaId,
  initialCount,
  initialReacted,
}: {
  mediaId: string;
  initialCount: number;
  initialReacted: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [reacted, setReacted] = useState(initialReacted);

  async function toggle() {
    setReacted(!reacted);
    setCount((c) => (reacted ? c - 1 : c + 1));

    await fetch(`/api/media/${mediaId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'heart' }),
    });
  }

  return (
    <button onClick={toggle} className="flex items-center gap-1" data-testid="reaction-button">
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill={reacted ? '#E24B4A' : 'none'}
        stroke={reacted ? '#E24B4A' : 'currentColor'}
        strokeWidth="1.5"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span className="text-xs text-text-secondary" data-testid="reaction-count">{count}</span>
    </button>
  );
}