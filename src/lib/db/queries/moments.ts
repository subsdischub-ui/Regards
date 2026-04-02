import { db } from '@/lib/db';
import { moments, media, guests } from '@/lib/db/schema';
import { asc, eq, and, gte, lte, sql } from 'drizzle-orm';

export async function getAllMoments() {
  return db.query.moments.findMany({ orderBy: [asc(moments.startTime)] });
}

export async function getMomentsWithMedia() {
  const allMoments = await getAllMoments();

  return Promise.all(
    allMoments.map(async (moment) => {
      const photos = await db
        .select({
          id: media.id,
          thumbnailUrl: media.thumbnailUrl,
          guestId: media.guestId,
          guestName: guests.name,
        })
        .from(media)
        .leftJoin(guests, eq(media.guestId, guests.id))
        .where(
          and(
            eq(media.processingStatus, 'done'),
            gte(media.takenAt, moment.startTime),
            lte(media.takenAt, moment.endTime),
          )
        )
        .limit(6);

      const photoCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(media)
        .where(
          and(
            eq(media.processingStatus, 'done'),
            gte(media.takenAt, moment.startTime),
            lte(media.takenAt, moment.endTime),
          )
        );

      const uniqueGuests = await db
        .select({ count: sql<number>`count(DISTINCT guest_id)` })
        .from(media)
        .where(
          and(
            eq(media.processingStatus, 'done'),
            gte(media.takenAt, moment.startTime),
            lte(media.takenAt, moment.endTime),
          )
        );

      return {
        ...moment,
        previews: photos,
        photoCount: photoCount[0]?.count ?? 0,
        guestCount: uniqueGuests[0]?.count ?? 0,
      };
    })
  );
}