import { Server } from '@tus/server';
import { S3Store } from '@tus/s3-store';
import { BUCKET, ensureBucket } from '@/lib/minio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  // tus only transfers and stores the bytes here. Creating the media row is a
  // separate, explicit step (`POST /api/upload/finalize`) the client triggers
  // once EVERY file has fully uploaded. Decoupling means an interrupted upload
  // can never produce a half-written, unplayable media — finalize verifies the
  // stored object's size before committing it. The S3 object key is the tus
  // upload id (no prefix), which the client reads from `upload.url`.
  tusServer = new Server({
    path: '/api/upload/tus',
    datastore: store,
    respectForwardedHeaders: true,
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
