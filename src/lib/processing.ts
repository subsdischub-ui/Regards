type ProcessingJob = {
  mediaId: string;
  fileUrl: string;
  fileType: string;
};

const queue: ProcessingJob[] = [];
// mediaIds currently queued or in-flight — prevents the same media from being
// processed twice (e.g. crash-recovery re-enqueue racing a fresh upload).
const tracked = new Set<string>();
let isProcessing = false;

export function enqueueProcessing(mediaId: string, fileUrl: string, fileType: string) {
  if (tracked.has(mediaId)) return;
  tracked.add(mediaId);
  queue.push({ mediaId, fileUrl, fileType });
  if (!isProcessing) {
    processNext();
  }
}

/**
 * Recover work left unfinished by a previous process (deploy, crash, OOM):
 *
 *  1. Media still in 'pending'/'processing' are re-enqueued — the in-memory
 *     queue is lost on restart, so otherwise they would never reach the feed.
 *  2. Media already in 'done' whose points were never settled (a crash in the
 *     gap between the 'done' write and awardUploadPoints) are credited
 *     directly — no reprocessing needed.
 *
 * Safe to call at startup and repeatedly: awardUploadPoints atomically claims
 * each media via `media.pointsAwarded`, so recovered items can never be
 * credited twice.
 */
export async function recoverStuckMedia(): Promise<number> {
  const { db } = await import('@/lib/db');
  const { media } = await import('@/lib/db/schema');
  const { inArray, and, eq } = await import('drizzle-orm');
  const { awardUploadPoints } = await import('@/lib/points');

  const stuck = await db
    .select({ id: media.id, fileUrl: media.fileUrl, fileType: media.fileType })
    .from(media)
    .where(inArray(media.processingStatus, ['pending', 'processing']));

  for (const item of stuck) {
    enqueueProcessing(item.id, item.fileUrl, item.fileType);
  }

  // Finished media whose points were never settled — credit them now.
  const unsettled = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.processingStatus, 'done'), eq(media.pointsAwarded, false)));

  for (const item of unsettled) {
    await awardUploadPoints(item.id).catch((err) =>
      console.error(`[processing] Points recovery failed for ${item.id}:`, err),
    );
  }

  if (stuck.length > 0 || unsettled.length > 0) {
    console.log(
      `[processing] Recovery: re-enqueued ${stuck.length} stuck, settled points for ${unsettled.length}.`,
    );
  }
  return stuck.length;
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
  } finally {
    tracked.delete(job.mediaId);
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

  // Generate video thumbnail via ffmpeg. Async on purpose: execSync froze the
  // entire Node event loop for up to 30s per video upload — every guest's
  // request stalled while one video was processed.
  if (isVideo) {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const fs = await import('node:fs/promises');
    const os = await import('node:os');
    const path = await import('node:path');
    const execFileAsync = promisify(execFile);

    const tmpInput = path.join(os.tmpdir(), `${job.mediaId}-input`);
    const tmpOutput = path.join(os.tmpdir(), `${job.mediaId}-thumb.jpg`);

    try {
      await fs.writeFile(tmpInput, buffer);
      // Argument array (no shell) — avoids the event-loop block and any shell parsing.
      await execFileAsync(
        'ffmpeg',
        ['-i', tmpInput, '-vframes', '1', '-q:v', '2', '-vf', 'scale=800:-1', tmpOutput, '-y'],
        { timeout: 30000 },
      );

      const thumbnailBuffer = await fs.readFile(tmpOutput);
      const thumbnailKey = `media/thumbnails/${job.mediaId}.jpg`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      }));
      updates.thumbnailUrl = thumbnailKey;
    } catch (err) {
      console.error(`Video thumbnail failed for ${job.mediaId}:`, err);
    } finally {
      // Always remove temp files, even when ffmpeg fails.
      await fs.rm(tmpInput, { force: true });
      await fs.rm(tmpOutput, { force: true });
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

  // Award points/badges before broadcasting so leaderboard data is consistent.
  try {
    const { awardUploadPoints } = await import('@/lib/points');
    await awardUploadPoints(job.mediaId);
  } catch (err) {
    console.error(`Points award failed for ${job.mediaId}:`, err);
  }

  // Broadcast the fully-formed media item so the live feed can render it directly.
  const { broadcast } = await import('@/lib/sse');
  const record = await db.query.media.findFirst({
    where: eq(media.id, job.mediaId),
    with: { guest: true },
  });
  if (record) {
    broadcast('new_media', {
      id: record.id,
      guestId: record.guestId,
      fileUrl: record.fileUrl,
      thumbnailUrl: record.thumbnailUrl,
      fileType: record.fileType,
      caption: record.caption,
      challengeId: record.challengeId,
      takenAt: record.takenAt,
      uploadedAt: record.uploadedAt,
      guest: record.guest
        ? { id: record.guest.id, name: record.guest.name, avatarUrl: record.guest.avatarUrl }
        : null,
      reactionCount: 0,
      commentCount: 0,
      hasReacted: false,
    });
  }
}