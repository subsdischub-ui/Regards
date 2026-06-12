import { NextResponse } from 'next/server';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET, ensureBucket } from '@/lib/minio';
import { getGuestId } from '@/lib/auth';
import { getGuest, updateGuest } from '@/lib/db/queries/guests';

export const runtime = 'nodejs';

const MAX_AVATAR_BYTES = 10 * 1024 * 1024; // 10MB before resize

export async function POST(request: Request) {
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guest = await getGuest(guestId);
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only images are accepted' }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // rotate() applies the EXIF orientation — phone selfies are often stored
  // rotated with an orientation tag that is lost after re-encoding.
  const sharp = (await import('sharp')).default;
  let avatar: Buffer;
  try {
    avatar = await sharp(buffer)
      .rotate()
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'Unreadable image' }, { status: 400 });
  }

  // Versioned key: the file proxy serves with a long Cache-Control, so
  // overwriting a fixed key would show the stale avatar after a change.
  const key = `media/avatars/${guestId}-${Date.now()}.jpg`;

  await ensureBucket();
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: avatar,
    ContentType: 'image/jpeg',
  }));

  // Best-effort cleanup of the previous avatar object
  if (guest.avatarUrl?.startsWith('media/avatars/')) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: guest.avatarUrl }));
    } catch {}
  }

  const updated = await updateGuest(guestId, { avatarUrl: key });
  return NextResponse.json(updated);
}
