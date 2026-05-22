import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { media, guests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as archiverNs from 'archiver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// archiver v7+ is ESM and exposes per-format classes instead of a factory.
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

  // Build the ZIP to a temp file FIRST. Any failure (archive error, disk error)
  // then happens before the HTTP response is committed, so it surfaces as a
  // clean 500 — instead of a 200 with a truncated, corrupt download that the
  // browser cannot detect as failed.
  const tmpPath = join(tmpdir(), `regards-export-${crypto.randomUUID()}.zip`);

  try {
    const archive = new ZipArchive({ zlib: { level: 0 } }); // media is already compressed
    // pipeline rejects if either the archive or the write stream errors.
    const writeDone = pipeline(archive, createWriteStream(tmpPath));

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
        // A single unreadable object must not abort the whole export.
        console.error(`[export] skipped ${row.fileUrl}:`, err);
      }
    }

    await archive.finalize();
    await writeDone; // throws here if the archive could not be written

    const { size } = await stat(tmpPath);
    const fileStream = createReadStream(tmpPath);
    // Remove the temp file once the response is fully streamed (or aborted).
    fileStream.on('close', () => {
      void rm(tmpPath, { force: true });
    });

    return new Response(Readable.toWeb(fileStream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="regards-album.zip"',
        'Content-Length': String(size),
      },
    });
  } catch (err) {
    console.error('[export] archive build failed:', err);
    await rm(tmpPath, { force: true }).catch(() => {});
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
