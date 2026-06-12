import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guests, media, guestbookMessages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { getAdminSession } from '@/lib/auth';

// Admin-only guest deletion. The DB cascade (media, comments, reactions,
// guestbook messages) does NOT reach MinIO — without explicit cleanup the
// guest's files would stay orphaned in the bucket forever. Collect every
// object key BEFORE deleting the row, then best-effort delete them.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ guestId: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { guestId } = await params;
  const guest = await db.query.guests.findFirst({ where: eq(guests.id, guestId) });
  if (!guest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const guestMedia = await db
    .select({ fileUrl: media.fileUrl, thumbnailUrl: media.thumbnailUrl })
    .from(media)
    .where(eq(media.guestId, guestId));

  const audioMessages = await db
    .select({ audioUrl: guestbookMessages.audioUrl })
    .from(guestbookMessages)
    .where(eq(guestbookMessages.guestId, guestId));

  const keys = [
    ...guestMedia.map((m) => m.fileUrl),
    ...guestMedia.map((m) => m.thumbnailUrl),
    ...audioMessages.map((a) => a.audioUrl),
    guest.avatarUrl,
  ].filter((k): k is string => Boolean(k));

  let filesDeleted = 0;
  for (const key of keys) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      filesDeleted++;
    } catch {
      // Missing object — nothing to clean up
    }
  }

  await db.delete(guests).where(eq(guests.id, guestId));

  return NextResponse.json({
    deleted: true,
    mediaCount: guestMedia.length,
    filesDeleted,
  });
}
