import { db } from '@/lib/db';
import { reactions } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function toggleReaction(mediaId: string, guestId: string, type = 'heart') {
  const existing = await db.query.reactions.findFirst({
    where: and(
      eq(reactions.mediaId, mediaId),
      eq(reactions.guestId, guestId),
      eq(reactions.type, type),
    ),
  });

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    return { action: 'removed' as const };
  }

  await db.insert(reactions).values({ mediaId, guestId, type });
  return { action: 'added' as const };
}

export async function getReactionCount(mediaId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(reactions)
    .where(eq(reactions.mediaId, mediaId));
  return result[0]?.count ?? 0;
}

export async function hasUserReacted(mediaId: string, guestId: string, type = 'heart') {
  const existing = await db.query.reactions.findFirst({
    where: and(
      eq(reactions.mediaId, mediaId),
      eq(reactions.guestId, guestId),
      eq(reactions.type, type),
    ),
  });
  return !!existing;
}