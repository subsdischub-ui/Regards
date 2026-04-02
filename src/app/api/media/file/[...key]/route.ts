import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET } from '@/lib/minio';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const fileKey = key.join('/');
  const download = request.nextUrl.searchParams.get('download') === 'true';

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      ...(download && {
        ResponseContentDisposition: `attachment; filename="${fileKey.split('/').pop()}"`,
      }),
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

    return NextResponse.redirect(signedUrl, 302);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}