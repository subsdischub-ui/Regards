import { NextResponse } from 'next/server';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { enqueueProcessing } from '@/lib/processing';
import { getGuestId } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The S3 object key is the tus upload id — a URL-safe token, never a path.
// Reject anything with separators or traversal so a client can't point us at
// an arbitrary object.
function isSafeKey(k: unknown): k is string {
  return (
    typeof k === 'string' &&
    k.length >= 8 &&
    k.length <= 256 &&
    !k.includes('/') &&
    !k.includes('\\') &&
    !k.includes('..')
  );
}

// Commit fully-uploaded media. Bytes are already in S3 (via tus); this verifies
// each object is complete, then creates the media row and queues processing.
export async function POST(request: Request) {
  const cookieGuest = await getGuestId();
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items[] required' }, { status: 400 });
  }

  const guestId = cookieGuest ?? (UUID_RE.test(body.guestId || '') ? body.guestId : null);
  if (!guestId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const created: string[] = [];
  const failedKeys: string[] = [];

  for (const item of body.items) {
    const key = item?.key;
    if (!isSafeKey(key)) {
      if (typeof key === 'string') failedKeys.push(key);
      continue;
    }

    // Completeness gate: the stored object must exist and its size must match
    // what the client uploaded. A truncated/interrupted upload fails here and
    // never becomes an unplayable media.
    let contentLength = 0;
    try {
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      contentLength = head.ContentLength ?? 0;
    } catch {
      failedKeys.push(key);
      continue;
    }
    const expected = Number(item?.fileSize) || 0;
    if (contentLength <= 0 || (expected > 0 && contentLength !== expected)) {
      failedKeys.push(key);
      continue;
    }

    const fileType = typeof item?.fileType === 'string' ? item.fileType : 'application/octet-stream';
    const caption =
      typeof item?.caption === 'string' && item.caption.trim() ? item.caption.trim() : null;
    const challengeId = UUID_RE.test(item?.challengeId || '') ? item.challengeId : null;
    const momentId = UUID_RE.test(item?.momentId || '') ? item.momentId : null;

    try {
      const [record] = await db
        .insert(media)
        .values({
          guestId,
          fileUrl: key,
          fileType,
          fileSize: contentLength,
          caption,
          challengeId,
          momentId,
          processingStatus: 'pending',
        })
        .returning();

      enqueueProcessing(record.id, key, fileType);
      created.push(record.id);
    } catch {
      failedKeys.push(key);
    }
  }

  return NextResponse.json({ created, failedKeys });
}
