type ProcessingJob = {
  mediaId: string;
  fileUrl: string;
  fileType: string;
};

const queue: ProcessingJob[] = [];
let isProcessing = false;

export function enqueueProcessing(mediaId: string, fileUrl: string, fileType: string) {
  queue.push({ mediaId, fileUrl, fileType });
  if (!isProcessing) {
    processNext();
  }
}

async function processNext() {
  if (queue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const job = queue.shift()!;

  try {
    await processMedia(job);
  } catch (err) {
    console.error(`Processing failed for ${job.mediaId}:`, err);
    // Update status to 'error'
    const { db } = await import('@/lib/db');
    const { media } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(media).set({ processingStatus: 'error' }).where(eq(media.id, job.mediaId));
  }

  // Process next in queue
  processNext();
}

async function processMedia(job: ProcessingJob) {
  const { db } = await import('@/lib/db');
  const { media } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { s3Client, BUCKET } = await import('@/lib/minio');
  const sharp = (await import('sharp')).default;

  await db.update(media).set({ processingStatus: 'processing' }).where(eq(media.id, job.mediaId));

  // Download from MinIO
  const obj = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: job.fileUrl }));
  const bodyBytes = await obj.Body!.transformToByteArray();
  const buffer = Buffer.from(bodyBytes);

  const updates: Record<string, any> = {};

  const isVideo = job.fileType.startsWith('video/');
  const isImage = job.fileType.startsWith('image/');

  // Extract EXIF from images
  if (isImage) {
    try {
      const exifr = (await import('exifr')).default;
      const exif = await exifr.parse(buffer, ['DateTimeOriginal', 'ImageWidth', 'ImageHeight']);
      if (exif?.DateTimeOriginal) {
        updates.takenAt = new Date(exif.DateTimeOriginal);
      }
      if (exif?.ImageWidth) updates.width = exif.ImageWidth;
      if (exif?.ImageHeight) updates.height = exif.ImageHeight;
    } catch {
      // EXIF extraction failed, continue without it
    }

    // Generate thumbnail
    const thumbnail = await sharp(buffer)
      .resize(800, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailKey = `media/thumbnails/${job.mediaId}.jpg`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: 'image/jpeg',
    }));
    updates.thumbnailUrl = thumbnailKey;

    // Get dimensions from sharp if not from EXIF
    if (!updates.width) {
      const meta = await sharp(buffer).metadata();
      updates.width = meta.width;
      updates.height = meta.height;
    }
  }

  // Generate video thumbnail via ffmpeg
  if (isVideo) {
    try {
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');

      const tmpInput = path.join(os.tmpdir(), `${job.mediaId}-input`);
      const tmpOutput = path.join(os.tmpdir(), `${job.mediaId}-thumb.jpg`);

      fs.writeFileSync(tmpInput, buffer);
      execSync(`ffmpeg -i "${tmpInput}" -vframes 1 -q:v 2 -vf "scale=800:-1" "${tmpOutput}" -y`, {
        timeout: 30000,
      });

      const thumbnailBuffer = fs.readFileSync(tmpOutput);
      const thumbnailKey = `media/thumbnails/${job.mediaId}.jpg`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      }));
      updates.thumbnailUrl = thumbnailKey;

      // Cleanup temp files
      fs.unlinkSync(tmpInput);
      fs.unlinkSync(tmpOutput);
    } catch (err) {
      console.error(`Video thumbnail failed for ${job.mediaId}:`, err);
    }

    // Use upload time as taken_at for videos
    updates.takenAt = new Date();
  }

  // Fallback: if no takenAt was extracted, use now
  if (!updates.takenAt) {
    updates.takenAt = new Date();
  }

  // Mark as done
  updates.processingStatus = 'done';
  await db.update(media).set(updates).where(eq(media.id, job.mediaId));

  // Broadcast SSE event
  const { broadcast } = await import('@/lib/sse');
  const record = await db.query.media.findFirst({
    where: eq(media.id, job.mediaId),
    with: { guest: true },
  });
  // SSE will be implemented in Task 9
  try {
    broadcast('new_media', {
      mediaId: job.mediaId,
      guestName: record?.guest?.name,
      thumbnailUrl: updates.thumbnailUrl,
    });
  } catch {
    // SSE not yet initialized
  }

  // Calculate points (will be implemented in Task 14)
  try {
    const { awardUploadPoints } = await import('@/lib/points');
    await awardUploadPoints(job.mediaId);
  } catch {
    // Points system not yet initialized
  }
}