import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const fileKey = key.join('/');
  const download = request.nextUrl.searchParams.get('download') === 'true';

  try {
    const obj = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: fileKey })
    );
    if (!obj.Body) {
      return NextResponse.json({ error: 'Empty body' }, { status: 502 });
    }

    const headers: Record<string, string> = {
      'Content-Type': obj.ContentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600, immutable',
    };
    if (obj.ContentLength) headers['Content-Length'] = String(obj.ContentLength);
    if (obj.ETag) headers['ETag'] = obj.ETag;
    if (download) {
      const filename = fileKey.split('/').pop() ?? 'file';
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }

    const webStream = (obj.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream();
    return new Response(webStream, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
