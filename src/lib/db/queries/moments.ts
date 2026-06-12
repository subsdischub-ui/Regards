import { db } from '@/lib/db';
import { moments, media, guests } from '@/lib/db/schema';
import { asc, eq, and, or, gte, lte, isNull, sql } from 'drizzle-orm';

export async function getAllMoments() {
  return db.query.moments.findMany({ orderBy: [asc(moments.startTime)] });
}

// A media belongs to a moment if the guest picked it explicitly at upload
// (momentId), or — for media without an explicit choice — if its takenAt
// (EXIF / upload time) falls within the moment's time window.
function mediaInMoment(moment: { id: string; startTime: Date; endTime: Date }) {
  return and(
    eq(media.processingStatus, 'done'),
    or(
      eq(media.momentId, moment.id),
      and(
        isNull(media.momentId),
        gte(media.takenAt, moment.startTime),
        lte(media.takenAt, moment.endTime),
      ),
    ),
  );
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
        .where(mediaInMoment(moment))
        .limit(6);

      const photoCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(media)
        .where(mediaInMoment(moment));

      const uniqueGuests = await db
        .select({ count: sql<number>`count(DISTINCT guest_id)` })
        .from(media)
        .where(mediaInMoment(moment));

      return {
        ...moment,
        previews: photos,
        photoCount: photoCount[0]?.count ?? 0,
        guestCount: uniqueGuests[0]?.count ?? 0,
      };
    })
  );
}
