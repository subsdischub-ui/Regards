import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { media, guests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { Readable } from 'node:stream';
import * as archiverNs from 'archiver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// archiver v7 is ESM and exposes per-format classes instead of a factory.
type ZipArchiveInstance = Readable & {
  append: (src: Buffer, opts: { name: string }) => void;
  finalize: () => Promise<void> | void;
  on: (event: string, cb: (err: unknown) => void) => void;
};
const ZipArchive = (archiverNs as unknown as {
  ZipArchive: new (opts?: unknown) => ZipArchiveInstance;
}).ZipArchive;

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({
      id: media.id,
      fileUrl: media.fileUrl,
      fileType: media.fileType,
      guestName: guests.name,
    })
    .from(media)
    .leftJoin(guests, eq(media.guestId, guests.id))
    .where(eq(media.processingStatus, 'done'));

  // Media files are already compressed — store (level 0) keeps it fast.
  const archive = new ZipArchive({ zlib: { level: 0 } });
  archive.on('error', (err) => console.error('[export] archive error:', err));

  // Stream entries into the archive while the response is being sent.
  (async () => {
    for (const row of rows) {
      try {
        const obj = await s3Client.send(
          new GetObjectCommand({ Bucket: BUCKET, Key: row.fileUrl })
        );
        if (!obj.Body) continue;
        const bytes = await obj.Body.transformToByteArray();
        const ext = (row.fileType.split('/')[1] || 'bin').split(';')[0];
        const safeGuest = (row.guestName || 'invite').replace(/[^a-zA-Z0-9_-]/g, '_');
        archive.append(Buffer.from(bytes), { name: `${safeGuest}/${row.id}.${ext}` });
      } catch (err) {
        console.error(`[export] skipped ${row.fileUrl}:`, err);
      }
    }
    archive.finalize();
  })();

  const webStream = Readable.toWeb(archive) as ReadableStream;

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="regards-album.zip"',
    },
  });
}
