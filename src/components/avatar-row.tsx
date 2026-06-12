'use client';

type Guest = { id: string; name: string; avatarUrl: string | null };

export default function AvatarRow({
  guests,
  activeGuestId,
  onSelect,
}: {
  guests: Guest[];
  activeGuestId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto border-b border-border px-4 py-3">
      {/* "TOUS" chip */}
      <button
        onClick={() => onSelect(null)}
        className="flex flex-shrink-0 flex-col items-center gap-1"
      >
        <div
          className={`flex h-[50px] w-[50px] items-center justify-center rounded-full border-2 ${
            !activeGuestId ? 'border-primary bg-bg-secondary' : 'border-transparent bg-bg-secondary'
          }`}
        >
          <span className="text-xs font-medium text-primary">TOUS</span>
        </div>
        <span className="text-[10px] text-text-tertiary">Tous</span>
      </button>

      {guests.map((g) => (
        <button
          key={g.id}
          onClick={() => onSelect(g.id)}
          className="flex flex-shrink-0 flex-col items-center gap-1"
        >
          <div
            className={`flex h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-full border-2 ${
              activeGuestId === g.id ? 'border-secondary' : 'border-transparent'
            } bg-bg-secondary`}
          >
            {g.avatarUrl ? (
              <img
                src={`/api/media/file/${g.avatarUrl}`}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium text-text-secondary">
                {g.name.charAt(0)}
              </span>
            )}
          </div>
          <span className="text-[10px] text-text-tertiary">{g.name}</span>
        </button>
      ))}
    </div>
  );
}