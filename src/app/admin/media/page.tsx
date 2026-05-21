import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { media, guests } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import MediaAdmin from './media-admin';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
  if (!(await getAdminSession())) redirect('/admin/login');

  const rows = await db
    .select({
      id: media.id,
      fileUrl: media.fileUrl,
      thumbnailUrl: media.thumbnailUrl,
      fileType: media.fileType,
      processingStatus: media.processingStatus,
      uploadedAt: media.uploadedAt,
      guestName: guests.name,
    })
    .from(media)
    .leftJoin(guests, eq(media.guestId, guests.id))
    .orderBy(desc(media.uploadedAt));

  const initial = rows.map((r) => ({
    id: r.id,
    fileUrl: r.fileUrl,
    thumbnailUrl: r.thumbnailUrl,
    fileType: r.fileType,
    processingStatus: r.processingStatus,
    guestName: r.guestName ?? '?',
  }));

  return <MediaAdmin initial={initial} />;
}
