import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guests, media, reactions } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export async function GET() {
  // Top guests by points
  const topGuests = await db.query.guests.findMany({
    orderBy: [desc(guests.points)],
    limit: 20,
  });

  // Most liked photo
  const mostLiked = await db
    .select({
      mediaId: reactions.mediaId,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(reactions)
    .groupBy(reactions.mediaId)
    .orderBy(sql`count(*) DESC`)
    .limit(1);

  let mostLikedMedia = null;
  if (mostLiked.length > 0) {
    mostLikedMedia = await db
      .select({
        id: media.id,
        thumbnailUrl: media.thumbnailUrl,
        guestName: guests.name,
        reactionCount: sql<number>`(SELECT count(*) FROM reactions WHERE media_id = ${media.id})`,
      })
      .from(media)
      .leftJoin(guests, eq(media.guestId, guests.id))
      .where(eq(media.id, mostLiked[0].mediaId))
      .then((rows) => rows[0] ?? null);
  }

  // Global stats
  const totalPhotos = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.processingStatus, 'done'));
  const activeGuests = await db.select({ count: sql<number>`count(*)` }).from(guests);
  const challengesCompleted = await db.select({ count: sql<number>`count(DISTINCT challenge_id)` }).from(media).where(sql`challenge_id IS NOT NULL`);

  return NextResponse.json({
    topGuests,
    mostLikedMedia,
    stats: {
      totalPhotos: totalPhotos[0]?.count ?? 0,
      activeGuests: activeGuests[0]?.count ?? 0,
      challengesCompleted: challengesCompleted[0]?.count ?? 0,
    },
  });
}