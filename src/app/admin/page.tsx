import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { guests, media } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) redirect('/admin/login');

  const totalGuests = await db.select({ count: sql<number>`count(*)` }).from(guests);
  const totalMedia = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.processingStatus, 'done'));
  const pendingSync = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.driveSynced, false));
  const totalVideos = await db.select({ count: sql<number>`count(*)` }).from(media).where(sql`file_type LIKE 'video/%'`);

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
        <div className="rounded-card bg-bg-secondary p-4">
          <p className="text-2xl font-medium">{pendingSync[0].count}</p>
          <p className="text-sm text-text-secondary">En attente Drive</p>
        </div>
      </div>

      <div className="space-y-3">
        <a href="/admin/challenges" className="block rounded-card border border-border p-4">
          Gérer les défis &rarr;
        </a>
        <a href="/admin/moments" className="block rounded-card border border-border p-4">
          Gérer les moments &rarr;
        </a>
        <form action="/api/sync-drive" method="POST">
          <button type="submit" className="w-full rounded-card bg-primary p-4 text-white">
            Forcer la sync Drive
          </button>
        </form>
      </div>
    </div>
  );
}