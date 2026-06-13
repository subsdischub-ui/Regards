import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET, getPublicMediaUrl, contentDispositionAttachment, filenameFromKey } from '@/lib/minio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const fileKey = key.join('/');
  const download = request.nextUrl.searchParams.get('download') === 'true';
  // HTTP Range support is mandatory for <audio>/<video> playback on iOS
  // Safari, which aborts any media response that is not a 206 byte-range
  // reply. Forwarding the Range header to S3 also enables seeking everywhere.
  const range = request.headers.get('range') ?? undefined;

  // When a public storage endpoint is configured, hand the browser a presigned
  // URL and let it fetch bytes straight from object storage — Node never touches
  // the payload (it just signs + 307s). The browser re-sends its Range header
  // when it follows the redirect, so seeking still works. We mark the redirect
  // itself cacheable for an hour (< the 24h presign TTL) so a returning visitor
  // reuses the cached redirect + cached object instead of re-signing and
  // re-downloading every asset on each view. Falls through to the streaming
  // proxy when not configured.
  const directUrl = await getPublicMediaUrl(fileKey, { download });
  if (directUrl) {
    const res = NextResponse.redirect(directUrl, 307);
    res.headers.set('Cache-Control', 'public, max-age=3600');
    return res;
  }

  try {
    const obj = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: fileKey, Range: range })
    );
    if (!obj.Body) {
      return NextResponse.json({ error: 'Empty body' }, { status: 502 });
    }

    const isPartial = Boolean(range && obj.ContentRange);
    const headers: Record<string, string> = {
      'Content-Type': obj.ContentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600, immutable',
      'Accept-Ranges': 'bytes',
    };
    if (obj.ContentLength != null) headers['Content-Length'] = String(obj.ContentLength);
    if (obj.ETag) headers['ETag'] = obj.ETag;
    if (isPartial) headers['Content-Range'] = obj.ContentRange as string;
    if (download) {
      headers['Content-Disposition'] = contentDispositionAttachment(filenameFromKey(fileKey));
    }

    const webStream = (obj.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream();
    return new Response(webStream, { status: isPartial ? 206 : 200, headers });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
