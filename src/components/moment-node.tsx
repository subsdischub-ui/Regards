type Props = {
  label: string;
  startTime: string;
  endTime: string;
  photoCount: number;
  guestCount: number;
  previews: { id: string; thumbnailUrl: string | null }[];
  isLast?: boolean;
};

export default function MomentNode({ label, startTime, endTime, photoCount, guestCount, previews, isLast }: Props) {
  const start = new Date(startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const end = new Date(endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex gap-4" data-testid="moment-node">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-primary bg-white" />
        {!isLast && <div className="w-0.5 flex-1 bg-primary/20" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <p className="text-xs text-text-tertiary">{start} — {end}</p>
        <p className="mt-0.5 font-medium">{label}</p>
        <p className="text-xs text-text-secondary">
          {photoCount} photos &middot; {guestCount} regards
        </p>

        {previews.length > 0 && (
          <div className="mt-2 flex gap-1.5">
            {previews.slice(0, 4).map((p) => (
              <div key={p.id} className="h-14 w-14 overflow-hidden rounded-lg">
                <img
                  src={`/api/media/file/${p.thumbnailUrl || ''}`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}