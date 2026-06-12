import { NextResponse } from 'next/server';
import { getMediaById } from '@/lib/db/queries/media';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { getAdminSession, getGuestId } from '@/lib/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The uploader manages their own media; the admin can manage everything.
async function canManage(item: { guestId: string }): Promise<boolean> {
  if (await getAdminSession()) return true;
  const guestId = await getGuestId();
  return guestId !== null && guestId === item.guestId;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const viewerGuestId = (await getGuestId()) ?? undefined;
  const item = await getMediaById(mediaId, viewerGuestId);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const item = await getMediaById(mediaId);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await canManage(item))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // Only the moment assignment is editable for now. null/'' clears the
  // explicit choice and falls back to the takenAt time-window triage.
  if (!('momentId' in body)) {
    return NextResponse.json({ error: 'momentId is required' }, { status: 400 });
  }
  const momentId = body.momentId || null;
  if (momentId !== null && !UUID_RE.test(momentId)) {
    return NextResponse.json({ error: 'Invalid momentId' }, { status: 400 });
  }

  const [updated] = await db
    .update(media)
    .set({ momentId })
    .where(eq(media.id, mediaId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const item = await getMediaById(mediaId);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await canManage(item))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delete from MinIO
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: item.fileUrl }));
    if (item.thumbnailUrl) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: item.thumbnailUrl }));
    }
  } catch {}

  // Delete from database
  await db.delete(media).where(eq(media.id, mediaId));

  return NextResponse.json({ deleted: true });
}
