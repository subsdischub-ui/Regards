import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { guests, media } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import QRGenerator from '@/components/qr-generator';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) redirect('/admin/login');

  const driveEnabled = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const totalGuests = await db.select({ count: sql<number>`count(*)` }).from(guests);
  const totalMedia = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.processingStatus, 'done'));
  const totalVideos = await db.select({ count: sql<number>`count(*)` }).from(media).where(sql`file_type LIKE 'video/%'`);
  const pendingSync = driveEnabled
    ? await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.driveSynced, false))
    : null;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 font-serif text-2xl">Dashboard — Regards</h1>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-card bg-bg-secondary p-4">
          <p className="text-2xl font-medium">{totalGuests[0].count}</p>
          <p className="text-sm text-text-secondary">Invités</p>
        </div>
        <div className="rounded-card bg-bg-secondary p-4">
          <p className="text-2xl font-medium">{totalMedia[0].count}</p>
          <p className="text-sm text-text-secondary">Photos & vidéos</p>
        </div>
        <div className="rounded-card bg-bg-secondary p-4">
          <p className="text-2xl font-medium">{totalVideos[0].count}</p>
          <p className="text-sm text-text-secondary">Vidéos</p>
        </div>
        {driveEnabled && pendingSync ? (
          <div className="rounded-card bg-bg-secondary p-4">
            <p className="text-2xl font-medium">{pendingSync[0].count}</p>
            <p className="text-sm text-text-secondary">En attente Drive</p>
          </div>
        ) : (
          <div className="rounded-card bg-bg-secondary p-4">
            <p className="text-sm font-medium">Drive désactivé</p>
            <p className="mt-1 text-xs text-text-secondary">Stockage local uniquement</p>
          </div>
        )}
      </div>

      <div className="mb-8 space-y-3">
        <a href="/admin/challenges" className="block rounded-card border border-border p-4">
          Gérer les défis &rarr;
        </a>
        <a href="/admin/moments" className="block rounded-card border border-border p-4">
          Gérer les moments &rarr;
        </a>
        <a href="/admin/media" className="block rounded-card border border-border p-4">
          Modérer les médias &rarr;
        </a>
        <a href="/admin/guests" className="block rounded-card border border-border p-4">
          Gérer les invités &rarr;
        </a>
        <a href="/slideshow" target="_blank" className="block rounded-card border border-border p-4">
          Ouvrir le diaporama live &rarr;
        </a>
        <a
          href="/api/admin/export"
          className="block rounded-card bg-secondary p-4 text-center font-medium text-white"
        >
          Télécharger l&apos;album complet (ZIP)
        </a>
        {driveEnabled && (
          <form action="/api/sync-drive" method="POST">
            <button type="submit" className="w-full rounded-card bg-primary p-4 text-white">
              Forcer la sync Drive
            </button>
          </form>
        )}
      </div>

      {/* QR code for guests */}
      <div className="rounded-card bg-bg-secondary p-5">
        <h2 className="mb-3 text-center font-serif text-lg">QR code invités</h2>
        <p className="mb-4 text-center text-xs text-text-secondary">
          À imprimer sur un chevalet ou une carte — les invités le scannent pour rejoindre.
        </p>
        <QRGenerator url={appUrl} />
      </div>
    </div>
  );
}
