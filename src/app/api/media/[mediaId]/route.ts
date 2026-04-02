import { NextResponse } from 'next/server';
import { getMediaById } from '@/lib/db/queries/media';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { getAdminSession } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const item = await getMediaById(mediaId);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { mediaId } = await params;
  const item = await getMediaById(mediaId);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
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