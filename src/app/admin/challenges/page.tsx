import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAllChallenges } from '@/lib/db/queries/challenges';
import ChallengesAdmin from './challenges-admin';

export const dynamic = 'force-dynamic';

export default async function AdminChallengesPage() {
  if (!(await getAdminSession())) redirect('/admin/login');

  const rows = await getAllChallenges();
  const initial = rows.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    points: c.points,
    unlockAt: c.unlockAt ? c.unlockAt.toISOString() : null,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  }));

  return <ChallengesAdmin initial={initial} />;
}
