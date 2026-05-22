import { db } from '@/lib/db';
import { guests, media, reactions, comments } from '@/lib/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { broadcast } from '@/lib/sse';

type BadgeCheckInput = {
  currentBadges: string[];
  photoCount: number;
  videoCount: number;
  commentCount: number;
  reactionCount: number;
  challengeCount: number;
  isFirstUpload: boolean;
  isAfterMidnight: boolean;
};

const BADGE_RULES: { name: string; check: (input: BadgeCheckInput) => boolean }[] = [
  { name: 'Premier regard', check: (i) => i.isFirstUpload },
  { name: 'Paparazzi', check: (i) => i.photoCount >= 20 },
  { name: 'Vidéaste', check: (i) => i.videoCount >= 1 },
  { name: 'Social butterfly', check: (i) => i.commentCount >= 10 },
  { name: 'Chasseur de défis', check: (i) => i.challengeCount >= 5 },
  { name: 'Noctambule', check: (i) => i.isAfterMidnight },
  { name: 'Fan #1', check: (i) => i.reactionCount >= 50 },
];

export function checkBadges(input: BadgeCheckInput): string[] {
  return BADGE_RULES
    .filter((rule) => !input.currentBadges.includes(rule.name) && rule.check(input))
    .map((rule) => rule.name);
}

export async function awardUploadPoints(mediaId: string) {
  // Atomically claim the award. This conditional UPDATE returns a row only on
  // the first successful call for a given media; any later call (crash-recovery
  // re-processing, a double-enqueue) matches zero rows and exits early — so
  // points and badges can never be granted twice for the same upload.
  const claimed = await db
    .update(media)
    .set({ pointsAwarded: true })
    .where(and(eq(media.id, mediaId), eq(media.pointsAwarded, false)))
    .returning({ id: media.id });
  if (claimed.length === 0) return;

  const record = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
  if (!record) return;

  const guest = await db.query.guests.findFirst({ where: eq(guests.id, record.guestId) });
  if (!guest) return;

  let pts = record.fileType.startsWith('video/') ? 15 : 10;

  // Challenge bonus
  if (record.challengeId) {
    const { challenges } = await import('@/lib/db/schema');
    const challenge = await db.query.challenges.findFirst({
      where: eq(challenges.id, record.challengeId),
    });
    if (challenge) pts += challenge.points;
  }

  // First upload bonus: check if this is the very first media in the system
  const totalMedia = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.processingStatus, 'done'));
  const isFirstUpload = (totalMedia[0]?.count ?? 0) <= 1;
  if (isFirstUpload) pts += 20;

  await db.update(guests).set({ points: sql`points + ${pts}` }).where(eq(guests.id, guest.id));

  // Check badges
  const photoCount = await db.select({ count: sql<number>`count(*)` }).from(media).where(and(eq(media.guestId, guest.id), sql`file_type LIKE 'image/%'`));
  const videoCount = await db.select({ count: sql<number>`count(*)` }).from(media).where(and(eq(media.guestId, guest.id), sql`file_type LIKE 'video/%'`));
  const commentCount = await db.select({ count: sql<number>`count(*)` }).from(comments).where(and(eq(comments.guestId, guest.id), ne(comments.mediaId, sql`(SELECT id FROM media WHERE guest_id = ${guest.id} LIMIT 1)`)));
  const reactionCount = await db.select({ count: sql<number>`count(*)` }).from(reactions).where(eq(reactions.guestId, guest.id));
  const challengeCount = await db.select({ count: sql<number>`count(DISTINCT challenge_id)` }).from(media).where(and(eq(media.guestId, guest.id), sql`challenge_id IS NOT NULL`));

  const isAfterMidnight = record.takenAt ? record.takenAt.getHours() < 6 : false;

  const newBadges = checkBadges({
    currentBadges: guest.badges,
    photoCount: photoCount[0]?.count ?? 0,
    videoCount: videoCount[0]?.count ?? 0,
    commentCount: commentCount[0]?.count ?? 0,
    reactionCount: reactionCount[0]?.count ?? 0,
    challengeCount: challengeCount[0]?.count ?? 0,
    isFirstUpload,
    isAfterMidnight,
  });

  if (newBadges.length > 0) {
    await db.update(guests).set({
      badges: sql`badges || ${sql.raw(`ARRAY[${newBadges.map((b) => `'${b}'`).join(',')}]::text[]`)}`,
    }).where(eq(guests.id, guest.id));

    for (const badge of newBadges) {
      broadcast('badge_unlocked', { guestId: guest.id, badge });
    }
  }

  broadcast('leaderboard_update', {});
}

export async function awardReactionPoints(mediaId: string) {
  const record = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
  if (!record) return;

  // +2 points to the photo owner
  await db.update(guests).set({ points: sql`points + 2` }).where(eq(guests.id, record.guestId));
  broadcast('leaderboard_update', {});
}

export async function awardCommentPoints(guestId: string) {
  await db.update(guests).set({ points: sql`points + 5` }).where(eq(guests.id, guestId));
  broadcast('leaderboard_update', {});
}