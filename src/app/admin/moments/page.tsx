import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAllMoments } from '@/lib/db/queries/moments';
import MomentsAdmin from './moments-admin';

export const dynamic = 'force-dynamic';

export default async function AdminMomentsPage() {
  if (!(await getAdminSession())) redirect('/admin/login');

  const rows = await getAllMoments();
  const initial = rows.map((m) => ({
    id: m.id,
    label: m.label ?? '',
    startTime: m.startTime.toISOString(),
    endTime: m.endTime.toISOString(),
  }));

  return <MomentsAdmin initial={initial} />;
}
