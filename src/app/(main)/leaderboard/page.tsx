'use client';

import { useEffect, useState } from 'react';
import { useGuest } from '@/hooks/use-guest';

export default function LeaderboardPage() {
  const { guestId } = useGuest();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/leaderboard').then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="p-5 text-center text-sm text-text-tertiary">Chargement...</div>;

  const currentGuest = data.topGuests.find((g: any) => g.id === guestId);

  return (
    <div>
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Classement</h1>
      </div>

      <div className="p-5 space-y-6">
        {/* Global stats */}
        <div className="flex justify-around rounded-card bg-bg-secondary p-4">
          <div className="text-center">
            <p className="text-lg font-medium">{data.stats.activeGuests}</p>
            <p className="text-[11px] text-text-tertiary">Regards</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">{data.stats.totalPhotos}</p>
            <p className="text-[11px] text-text-tertiary">Photos</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">{data.stats.challengesCompleted}</p>
            <p className="text-[11px] text-text-tertiary">Défis</p>
          </div>
        </div>

        {/* My badges */}
        {currentGuest && currentGuest.badges.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-medium">Vos badges</h2>
            <div className="flex flex-wrap gap-2">
              {currentGuest.badges.map((badge: string) => (
                <span key={badge} className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Most liked photo */}
        {data.mostLikedMedia && (
          <div>
            <h2 className="mb-2 text-sm font-medium">Photo la plus aimée</h2>
            <div className="overflow-hidden rounded-card">
              <img
                src={`/api/media/file/${data.mostLikedMedia.thumbnailUrl}`}
                alt=""
                className="aspect-video w-full object-cover"
              />
              <div className="bg-bg-secondary p-3">
                <p className="text-sm">
                  Par <span className="font-medium">{data.mostLikedMedia.guestName}</span>
                  {' '}&middot; {data.mostLikedMedia.reactionCount} coeurs
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ranking */}
        <div>
          <h2 className="mb-2 text-sm font-medium">Top photographes</h2>
          <div className="space-y-2">
            {data.topGuests.map((g: any, i: number) => (
              <div
                key={g.id}
                className={`flex items-center gap-3 rounded-card p-3 ${
                  g.id === guestId ? 'bg-primary/5 border border-primary/20' : 'bg-bg-secondary'
                }`}
              >
                <span className="w-6 text-center text-sm font-medium text-text-tertiary">
                  {i + 1}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-sm font-medium">
                  {g.name.charAt(0)}
                </div>
                <span className="flex-1 text-sm font-medium">{g.name}</span>
                <span className="text-sm text-primary">{g.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}