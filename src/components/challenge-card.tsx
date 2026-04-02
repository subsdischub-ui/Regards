type Props = {
  title: string;
  description: string;
  points: number;
  isActive: boolean;
  unlockAt: string | null;
  completed: boolean;
  participations: number;
};

export default function ChallengeCard({ title, description, points, isActive, unlockAt, completed, participations }: Props) {
  const unlockTime = unlockAt
    ? new Date(unlockAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className={`rounded-card border-l-[3px] p-3.5 ${
        completed
          ? 'border-l-primary bg-bg-secondary'
          : isActive
            ? 'border-l-secondary bg-bg-secondary'
            : 'border-l-text-tertiary bg-bg-secondary opacity-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              +{points} pts
            </span>
            <span className="text-[11px] text-text-tertiary">{participations} participations</span>
          </div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
          {!isActive && unlockTime && (
            <p className="mt-1 text-xs text-text-tertiary">
              Déverrouillage à {unlockTime}
            </p>
          )}
        </div>
        {completed && (
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        {!isActive && !completed && (
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-text-tertiary/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A39E98" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}