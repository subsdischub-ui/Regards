import { Server } from '@tus/server';
import { S3Store } from '@tus/s3-store';
import { s3Client, BUCKET, ensureBucket } from '@/lib/minio';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { enqueueProcessing } from '@/lib/processing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let tusServer: Server | null = null;

async function getTusServer() {
  if (tusServer) return tusServer;

  await ensureBucket();

  const store = new S3Store({
    s3ClientConfig: {
      endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
      region: 'us-east-1', 
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true, bucket: BUCKET,
    },
    
    partSize: 8 * 1024 * 1024, // 8MB parts
  });

  tusServer = new Server({
    path: '/api/upload/tus',
    datastore: store,
    respectForwardedHeaders: true,
    async onUploadFinish(req, upload: any) {
      const metadata = upload.metadata;
      const guestId = metadata?.guest_id;
      const caption = metadata?.caption || null;
      const challengeId = metadata?.challenge_id || null;
      // Guard with a UUID check: a malformed value would make the whole
      // insert fail with an FK/cast error after the bytes are already stored.
      const momentId = UUID_RE.test(metadata?.moment_id || '') ? metadata.moment_id : null;
      const fileType = metadata?.filetype || 'application/octet-stream';
      const fileName = metadata?.filename || 'unknown';

      if (!guestId) {
        throw { status_code: 400, body: 'guest_id metadata required' };
      }

      // Insert media record.
      // `@tus/s3-store` writes the upload object to S3 at key = upload.id
      // (no prefix). Storing `media/originals/${upload.id}` in DB created a
      // mismatch: the file-serving proxy and the post-processing job both
      // looked at a path that didn't exist → 404 + sharp crash + processing
      // stuck in 'pending'/'error' + media never appeared in /feed.
      // Aligning fileUrl to the actual S3 key fixes the whole chain.
      // (Thumbnails keep their own `media/thumbnails/...` prefix because
      // processing.ts writes them with explicit PutObjectCommand keys.)
      const fileUrl = upload.id;
      const [record] = await db.insert(media).values({
        guestId,
        fileUrl,
        fileType,
        fileSize: upload.size ? Number(upload.size) : null,
        caption,
        challengeId: challengeId || null,
        momentId,
        processingStatus: 'pending',
      }).returning();

      // Queue async processing (thumbnail, EXIF, etc.)
      enqueueProcessing(record.id, fileUrl, fileType);

      return { status_code: 204 };
    },
  });

  return tusServer;
}

async function handleTus(req: Request): Promise<Response> {
  // `@tus/server` v2.0+ ships a built-in Fetch-API adapter (`handleWeb`) that
  // accepts a Web `Request` and returns a `Response`. It implements the full
  // Node `IncomingMessage` / `ServerResponse` shim internally (EventEmitter,
  // stream piping, header normalization), which the previous hand-rolled
  // adapter did NOT — it only stubbed `on()` and crashed with
  // `TypeError: r.req.once is not a function` as soon as `@tus/server`
  // registered error/end listeners. Result: every upload silently 502'd in prod.
  // Reusing the official adapter also fixes the body double-read bug
  // (ReadableStream can be consumed only once).
  const server = await getTusServer();
  return server.handleWeb(req);
}

export const POST = handleTus;
export const PATCH = handleTus;
export const HEAD = handleTus;
export const OPTIONS = handleTus;
export const DELETE = handleTus;
