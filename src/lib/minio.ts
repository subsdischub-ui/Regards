import { S3Client, CreateBucketCommand, HeadBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3Client = new S3Client({
  endpoint: `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
});

export const BUCKET = process.env.MINIO_BUCKET || 'regards';

// Optional public storage endpoint (e.g. https://storage.example.com) reachable
// by browsers. When set, media is served via short-lived presigned URLs pointing
// here, so bytes stream DIRECTLY from object storage instead of through the Node
// app — removing the single biggest source of feed slowness under load. The
// in-cluster `minio:9000` endpoint above is not reachable from a phone, so a
// separate client is needed whose request signatures are valid for this host.
const PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT;

const publicClient = PUBLIC_ENDPOINT
  ? new S3Client({
      endpoint: PUBLIC_ENDPOINT,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true,
    })
  : null;

/** True when media can be served directly from object storage (proxy bypassed). */
export const MEDIA_DIRECT = Boolean(publicClient);

/**
 * A short-lived presigned GET URL on the public storage host, or null when no
 * public endpoint is configured (callers then fall back to the `/api/media/file`
 * proxy). Range requests and browser caching are handled by object storage.
 */
export async function getPublicMediaUrl(
  key: string,
  opts?: { download?: boolean; filename?: string },
): Promise<string | null> {
  if (!publicClient) return null;
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(opts?.download
      ? {
          ResponseContentDisposition: `attachment; filename="${opts.filename ?? key.split('/').pop() ?? 'file'}"`,
        }
      : {}),
  });
  return getSignedUrl(publicClient, cmd, { expiresIn: 3600 });
}

export async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" created.`);
  }
}