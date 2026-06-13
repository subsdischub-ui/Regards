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

// Presigned URLs are valid for 24h. The proxy/redirect that hands them out is
// itself browser-cacheable for a shorter window (see the media route), so a
// returning visitor reuses the same signed URL from cache rather than minting a
// fresh one every load. The long validity also keeps a media element on a tab
// left open for hours from hitting an expired URL mid-seek.
const PRESIGN_TTL_SECONDS = 24 * 60 * 60;

/**
 * Build a `Content-Disposition: attachment` value that survives quotes and
 * non-ASCII (e.g. accented French filenames): an ASCII-sanitised `filename`
 * fallback plus an RFC 5987 `filename*` with the real UTF-8 name. Shared by the
 * presign path and the streaming proxy so download names never diverge.
 */
export function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[\\"]/g, '_').replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * A presigned GET URL on the public storage host, or null when no public
 * endpoint is configured (callers then fall back to the `/api/media/file`
 * proxy). Range requests are honoured by object storage: the browser re-sends
 * its `Range` header when it follows the redirect, and the signature only pins
 * `host`, so the unsigned `Range` is accepted (→ 206). Caching is handled by
 * the redirect that serves this URL.
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
          ResponseContentDisposition: contentDispositionAttachment(
            opts.filename ?? key.split('/').pop() ?? 'file',
          ),
        }
      : {}),
  });
  return getSignedUrl(publicClient, cmd, { expiresIn: PRESIGN_TTL_SECONDS });
}

export async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" created.`);
  }
}