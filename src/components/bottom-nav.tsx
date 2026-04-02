'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/feed', label: 'Feed', icon: 'grid' },
  { href: '/challenges', label: 'Défis', icon: 'star' },
  { href: '/upload', label: '', icon: 'camera', isCenter: true },
  { href: '/moments', label: 'Moments', icon: 'clock' },
  { href: '/leaderboard', label: 'Score', icon: 'chart' },
];

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const stroke = active ? '#5B6B52' : '#A39E98';
  const iconMap: Record<string, React.ReactNode> = {
    grid: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
    star: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    camera: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    clock: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    chart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  };

  return iconMap[icon] || null;
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);

          if (item.isCenter) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center">
                <div className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-primary">
                  <NavIcon icon={item.icon} active={false} />
                </div>
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5">
              <NavIcon icon={item.icon} active={active} />
              <span className={`text-[10px] ${active ? 'font-medium text-primary' : 'text-text-tertiary'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
