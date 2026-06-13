import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { and, eq, isNull, like } from 'drizzle-orm';
import { getAdminSession } from '@/lib/auth';
import { enqueueProcessing } from '@/lib/processing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One-shot backfill: queue a web-version transcode for every existing video
// that doesn't have one yet. transcodeOnly keeps each video visible in the
// feed while its compressed version is built in the background.
export async function POST() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const videos = await db
    .select({ id: media.id, fileUrl: media.fileUrl, fileType: media.fileType })
    .from(media)
    .where(and(like(media.fileType, 'video/%'), isNull(media.webUrl), eq(media.processingStatus, 'done')));

  for (const v of videos) {
    enqueueProcessing(v.id, v.fileUrl, v.fileType, true);
  }

  return NextResponse.json({ queued: videos.length });
}

// Progress check: how many videos still lack a web version.
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const pending = await db
    .select({ id: media.id })
    .from(media)
    .where(and(like(media.fileType, 'video/%'), isNull(media.webUrl)));
  const total = await db
    .select({ id: media.id })
    .from(media)
    .where(like(media.fileType, 'video/%'));

  return NextResponse.json({ totalVideos: total.length, withoutWebVersion: pending.length });
}
