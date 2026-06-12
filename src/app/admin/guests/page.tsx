import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { guests } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';
import GuestsAdmin from './guests-admin';

export const dynamic = 'force-dynamic';

export default async function AdminGuestsPage() {
  if (!(await getAdminSession())) redirect('/admin/login');

  const rows = await db
    .select({
      id: guests.id,
      name: guests.name,
      relation: guests.relation,
      avatarUrl: guests.avatarUrl,
      points: guests.points,
      createdAt: guests.createdAt,
      mediaCount: sql<number>`(select count(*)::int from media where media.guest_id = ${guests.id})`,
    })
    .from(guests)
    .orderBy(desc(guests.createdAt));

  const initial = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    mediaCount: Number(r.mediaCount),
  }));

  return <GuestsAdmin initial={initial} />;
}
