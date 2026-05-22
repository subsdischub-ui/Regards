import { NextResponse } from 'next/server';
import { getGuestId } from '@/lib/auth';
import { db } from '@/lib/db';
import { guestbookMessages, guests } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET, ensureBucket } from '@/lib/minio';

export const runtime = 'nodejs';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export async function GET() {
  // The guestbook holds personal audio recordings; mirror the page-level
  // protection (middleware guards /guestbook) and the POST handler below.
  const guestId = await getGuestId();
  if (!guestId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({
      id: guestbookMessages.id,
      audioUrl: guestbookMessages.audioUrl,
      duration: guestbookMessages.duration,
      createdAt: guestbookMessages.createdAt,
      guest: {
        id: guests.id,
        name: guests.name,
        avatarUrl: guests.avatarUrl,
      },
    })
    .from(guestbookMessages)
    .leftJoin(guests, eq(guestbookMessages.guestId, guests.id))
    .orderBy(desc(guestbookMessages.createdAt));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const guestId = await getGuestId();
  if (!guestId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const audio = form.get('audio');
  const durationRaw = form.get('duration');

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'audio required' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'audio too large' }, { status: 413 });
  }

  await ensureBucket();

  const ext = (audio.type || '').includes('ogg') ? 'ogg' : 'webm';
  const key = `guestbook/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await audio.arrayBuffer());

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: bytes,
      ContentType: audio.type || 'audio/webm',
    })
  );

  const parsedDuration = durationRaw ? Math.round(Number(durationRaw)) : NaN;
  const [msg] = await db
    .insert(guestbookMessages)
    .values({
      guestId,
      audioUrl: key,
      duration: Number.isFinite(parsedDuration) ? parsedDuration : null,
    })
    .returning();

  return NextResponse.json(msg, { status: 201 });
}
