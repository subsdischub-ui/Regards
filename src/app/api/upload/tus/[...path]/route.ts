import { Server } from '@tus/server';
import { S3Store } from '@tus/s3-store';
import { s3Client, BUCKET, ensureBucket } from '@/lib/minio';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { enqueueProcessing } from '@/lib/processing';

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

  tusServer = new Server({
    path: '/api/upload/tus',
    datastore: store,
    respectForwardedHeaders: true,
    async onUploadFinish(req, upload: any) {
      const metadata = upload.metadata;
      const guestId = metadata?.guest_id;
      const caption = metadata?.caption || null;
      const challengeId = metadata?.challenge_id || null;
      const fileType = metadata?.filetype || 'application/octet-stream';
      const fileName = metadata?.filename || 'unknown';

      if (!guestId) {
        throw { status_code: 400, body: 'guest_id metadata required' };
      }

      // Insert media record
      const fileUrl = `media/originals/${upload.id}`;
      const [record] = await db.insert(media).values({
        guestId,
        fileUrl,
        fileType,
        fileSize: upload.size ? Number(upload.size) : null,
        caption,
        challengeId: challengeId || null,
        processingStatus: 'pending',
      }).returning();

      // Queue async processing (thumbnail, EXIF, etc.)
      enqueueProcessing(record.id, fileUrl, fileType);

      return { status_code: 204 };
    },
  });

  return tusServer;
}

async function handleTus(req: Request) {
  const server = await getTusServer();

  // Convert Web Request to Node-compatible format
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const body = req.body;

  return new Promise<Response>((resolve) => {
    const nodeReq = {
      method: req.method,
      url: new URL(req.url).pathname,
      headers: Object.fromEntries(req.headers.entries()),
      on: (event: string, cb: (chunk?: Uint8Array) => void) => {
        if (event === 'data' && body) {
          const reader = body.getReader();
          (async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              cb(value);
            }
          })();
        }
        if (event === 'end' && body) {
          body.getReader().closed.then(() => cb());
        }
      },
    };

    const headers: Record<string, string> = {};
    let statusCode = 200;

    const nodeRes = {
      setHeader: (key: string, value: string) => { headers[key] = value; },
      getHeader: (key: string) => headers[key],
      writeHead: (code: number, hdrs?: Record<string, string>) => {
        statusCode = code;
        if (hdrs) Object.assign(headers, hdrs);
      },
      end: (body?: string) => {
        resolve(new Response(body || null, { status: statusCode, headers }));
      },
    };

    server.handle(nodeReq as any, nodeRes as any);
  });
}

export const POST = handleTus;
export const PATCH = handleTus;
export const HEAD = handleTus;
export const OPTIONS = handleTus;
export const DELETE = handleTus;
