import { db } from '@/lib/db';
import { challenges, media } from '@/lib/db/schema';
import { eq, asc, sql, and } from 'drizzle-orm';

export async function getAllChallenges() {
  return db.query.challenges.findMany({ orderBy: [asc(challenges.sortOrder)] });
}

export async function getChallengeParticipations(challengeId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(media)
    .where(eq(media.challengeId, challengeId));
  return result[0]?.count ?? 0;
}

export async function getCompletedChallengeIds(guestId: string) {
  const result = await db
    .select({ challengeId: media.challengeId })
    .from(media)
    .where(and(eq(media.guestId, guestId), sql`challenge_id IS NOT NULL`))
    .groupBy(media.challengeId);
  return result.map((r) => r.challengeId).filter(Boolean) as string[];
}