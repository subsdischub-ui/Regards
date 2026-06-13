'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MomentNode from '@/components/moment-node';

export default function MomentsPage() {
  const [moments, setMoments] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/moments').then((r) => r.json()).then(setMoments);
  }, []);

  return (
    <div>
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Moments</h1>
        <p className="text-[11px] text-text-tertiary">La journée en un coup d'oeil</p>
      </div>

      <div className="p-5">
        {moments.map((m, i) => (
          <Link
            key={m.id}
            href={`/moments/${m.id}`}
            className="block transition-opacity active:opacity-60"
          >
            <MomentNode
              label={m.label}
              startTime={m.startTime}
              endTime={m.endTime}
              photoCount={m.photoCount}
              guestCount={m.guestCount}
              previews={m.previews}
              isLast={i === moments.length - 1}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}