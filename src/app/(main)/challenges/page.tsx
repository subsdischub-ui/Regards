'use client';

import { useEffect, useState } from 'react';
import ChallengeCard from '@/components/challenge-card';

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/challenges').then((r) => r.json()).then(setChallenges);
  }, []);

  const completed = challenges.filter((c) => c.completed).length;

  return (
    <div>
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Défis photo</h1>
        <p className="text-[11px] text-text-tertiary">{completed}/{challenges.length} complétés</p>
      </div>

      <div className="p-4">
        {/* Progress bar */}
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${challenges.length ? (completed / challenges.length) * 100 : 0}%` }}
          />
        </div>

        <div className="space-y-2.5">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} {...c} />
          ))}
        </div>
      </div>
    </div>
  );
}