import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

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

export async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" created.`);
  }
}
