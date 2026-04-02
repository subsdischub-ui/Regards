import { google } from 'googleapis';
import { db } from '@/lib/db';
import { media, guests, moments, config } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { Readable } from 'stream';

function getDriveClient() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(key),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string,
): Promise<string> {
  // Check if exists
  const existing = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (existing.data.files?.length) {
    return existing.data.files[0].id!;
  }

  // Create
  const folder = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return folder.data.id!;
}

function findClosestMoment(
  takenAt: Date,
  allMoments: { id: string; label: string | null; startTime: Date; endTime: Date }[],
): { id: string; label: string } | null {
  // Check if falls within a moment
  for (const m of allMoments) {
    if (takenAt >= m.startTime && takenAt <= m.endTime) {
      return { id: m.id, label: m.label || 'Moment' };
    }
  }

  // Find closest moment
  let closest = null;
  let minDiff = Infinity;

  for (const m of allMoments) {
    const diffStart = Math.abs(takenAt.getTime() - m.startTime.getTime());
    const diffEnd = Math.abs(takenAt.getTime() - m.endTime.getTime());
    const diff = Math.min(diffStart, diffEnd);

    if (diff < minDiff) {
      minDiff = diff;
      closest = m;
    }
  }

  // If closest is more than 2 hours away, it's "Autres"
  if (!closest || minDiff > 2 * 60 * 60 * 1000) {
    return null;
  }

  return { id: closest.id, label: closest.label || 'Moment' };
}

export async function syncToDrive() {
  const drive = getDriveClient();
  if (!drive) {
    console.log('[drive] No service account key configured, skipping sync.');
    return { synced: 0 };
  }

  // Get root folder ID
  const driveConfig = await db.query.config.findFirst({ where: eq(config.key, 'drive') });
  const rootFolderId = (driveConfig?.value as any)?.folder_id;
  if (!rootFolderId) {
    console.log('[drive] No root folder configured, skipping sync.');
    return { synced: 0 };
  }

  const allMomentsFolder = (driveConfig?.value as any)?.all_moments_folder_id;

  // Get unsynced media
  const unsynced = await db
    .select()
    .from(media)
    .leftJoin(guests, eq(media.guestId, guests.id))
    .where(and(eq(media.driveSynced, false), eq(media.processingStatus, 'done')))
    .limit(20);

  const allMoments = await db.query.moments.findMany();

  let synced = 0;

  for (const row of unsynced) {
    try {
      const m = row.media;
      const guest = row.guests;
      const guestName = guest?.name || 'Inconnu';
      const relation = guest?.relation || '';

      // Get or create guest folder
      let guestFolderId = guest?.driveFolderId;
      if (!guestFolderId) {
        const folderName = relation ? `${guestName} (${relation})` : guestName;
        guestFolderId = await getOrCreateFolder(drive, folderName, rootFolderId);
        if (guest) {
          await db.update(guests).set({ driveFolderId: guestFolderId }).where(eq(guests.id, guest.id));
        }
      }

      // Find moment for this media
      const moment = m.takenAt ? findClosestMoment(m.takenAt, allMoments) : null;
      const momentLabel = moment?.label || 'Autres';

      // Get or create moment subfolder in guest folder
      const momentFolderId = await getOrCreateFolder(drive, momentLabel, guestFolderId);

      // Download from MinIO (stream)
      const obj = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: m.fileUrl }));
      const stream = obj.Body as Readable;

      // Build filename
      const time = m.takenAt || m.uploadedAt;
      const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      const ext = m.fileUrl.split('.').pop() || 'jpg';
      const fileName = `${guestName}_${timeStr}_${m.id.slice(0, 8)}.${ext}`;

      // Upload to Drive
      const driveFile = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [momentFolderId],
        },
        media: {
          mimeType: m.fileType,
          body: stream,
        },
        fields: 'id',
      });

      // Create shortcut in _Tous les moments
      if (allMomentsFolder && moment) {
        const allMomentSubfolder = await getOrCreateFolder(
          drive,
          `${momentLabel} (${allMoments.find((am) => am.id === moment.id)?.startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') || ''})`,
          allMomentsFolder,
        );
        await drive.files.create({
          requestBody: {
            name: fileName,
            mimeType: 'application/vnd.google-apps.shortcut',
            shortcutDetails: { targetId: driveFile.data.id! },
            parents: [allMomentSubfolder],
          },
        });
      }

      // Mark as synced
      await db.update(media).set({
        driveSynced: true,
        driveFileId: driveFile.data.id!,
      }).where(eq(media.id, m.id));

      synced++;
    } catch (err) {
      console.error(`[drive] Sync failed for media ${row.media.id}:`, err);
    }
  }

  console.log(`[drive] Synced ${synced} files.`);
  return { synced };
}