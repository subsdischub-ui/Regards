import { db } from '@/lib/db';
import { media, guests, reactions, comments } from '@/lib/db/schema';
import { eq, desc, and, sql, lt, inArray } from 'drizzle-orm';

type MediaCounts = {
  reactionCount: number;
  commentCount: number;
  hasReacted: boolean;
};

type MediaWithGuest = typeof media.$inferSelect & {
  guest: Pick<typeof guests.$inferSelect, 'id' | 'name' | 'avatarUrl'> | null;
} & MediaCounts;

export type FeedItem =
  | { type: 'single'; item: MediaWithGuest }
  | { type: 'cluster'; items: MediaWithGuest[]; time: Date };

/** Attach reaction/comment counts + whether the viewer reacted, in batch. */
async function enrichMedia<T extends { id: string }>(
  items: T[],
  viewerGuestId?: string,
): Promise<(T & MediaCounts)[]> {
  if (items.length === 0) return [];
  const ids = items.map((i) => i.id);

  const [reactionRows, commentRows, reactedRows] = await Promise.all([
    db
      .select({ mediaId: reactions.mediaId, count: sql<number>`count(*)::int` })
      .from(reactions)
      .where(inArray(reactions.mediaId, ids))
      .groupBy(reactions.mediaId),
    db
      .select({ mediaId: comments.mediaId, count: sql<number>`count(*)::int` })
      .from(comments)
      .where(inArray(comments.mediaId, ids))
      .groupBy(comments.mediaId),
    viewerGuestId
      ? db
          .select({ mediaId: reactions.mediaId })
          .from(reactions)
          .where(and(inArray(reactions.mediaId, ids), eq(reactions.guestId, viewerGuestId)))
      : Promise.resolve([] as { mediaId: string }[]),
  ]);

  const reactionMap = new Map(reactionRows.map((r) => [r.mediaId, Number(r.count)]));
  const commentMap = new Map(commentRows.map((r) => [r.mediaId, Number(r.count)]));
  const reactedSet = new Set(reactedRows.map((r) => r.mediaId));

  return items.map((item) => ({
    ...item,
    reactionCount: reactionMap.get(item.id) ?? 0,
    commentCount: commentMap.get(item.id) ?? 0,
    hasReacted: reactedSet.has(item.id),
  }));
}

export function clusterMedia(items: MediaWithGuest[]): FeedItem[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) => (a.takenAt?.getTime() ?? 0) - (b.takenAt?.getTime() ?? 0)
  );

  const results: FeedItem[] = [];
  let current: MediaWithGuest[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const curr = sorted[i];
    const diffMs =
      (curr.takenAt?.getTime() ?? 0) - (prev.takenAt?.getTime() ?? 0);
    const differentGuest = curr.guestId !== prev.guestId;

    if (diffMs <= 120_000 && differentGuest) {
      current.push(curr);
    } else {
      flush(current, results);
      current = [curr];
    }
  }
  flush(current, results);

  // Sort results by time descending (newest first)
  return results.sort((a, b) => {
    const timeA = a.type === 'cluster' ? a.time.getTime() : (a.item.takenAt?.getTime() ?? 0);
    const timeB = b.type === 'cluster' ? b.time.getTime() : (b.item.takenAt?.getTime() ?? 0);
    return timeB - timeA;
  });
}

function flush(group: MediaWithGuest[], results: FeedItem[]) {
  if (group.length >= 2) {
    results.push({
      type: 'cluster',
      items: group,
      time: group[0].takenAt ?? group[0].uploadedAt,
    });
  } else {
    results.push({ type: 'single', item: group[0] });
  }
}

export async function getFeedMedia(options: {
  cursor?: string;
  limit?: number;
  guestId?: string;
  viewerGuestId?: string;
}) {
  const { cursor, limit = 20, guestId, viewerGuestId } = options;

  const conditions = [eq(media.processingStatus, 'done')];
  if (guestId) {
    conditions.push(eq(media.guestId, guestId));
  }
  if (cursor) {
    conditions.push(lt(media.uploadedAt, new Date(cursor)));
  }

  const items = await db
    .select({
      id: media.id,
      guestId: media.guestId,
      fileUrl: media.fileUrl,
      thumbnailUrl: media.thumbnailUrl,
      webUrl: media.webUrl,
      fileType: media.fileType,
      fileSize: media.fileSize,
      width: media.width,
      height: media.height,
      caption: media.caption,
      challengeId: media.challengeId,
      momentId: media.momentId,
      takenAt: media.takenAt,
      uploadedAt: media.uploadedAt,
      processingStatus: media.processingStatus,
      driveSynced: media.driveSynced,
      driveFileId: media.driveFileId,
      guest: {
        id: guests.id,
        name: guests.name,
        avatarUrl: guests.avatarUrl,
      },
    })
    .from(media)
    .leftJoin(guests, eq(media.guestId, guests.id))
    .where(and(...conditions))
    .orderBy(desc(media.uploadedAt))
    .limit(limit + 1); // +1 to check if there are more

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? page[page.length - 1].uploadedAt.toISOString() : null;

  const enriched = (await enrichMedia(page, viewerGuestId)) as MediaWithGuest[];

  // Only cluster in full feed mode (not filtered by guest)
  const feed = guestId
    ? enriched.map((item) => ({ type: 'single' as const, item }))
    : clusterMedia(enriched);

  return { feed, nextCursor };
}

export async function getMediaById(mediaId: string, viewerGuestId?: string) {
  const row = await db
    .select({
      id: media.id,
      guestId: media.guestId,
      fileUrl: media.fileUrl,
      thumbnailUrl: media.thumbnailUrl,
      webUrl: media.webUrl,
      fileType: media.fileType,
      fileSize: media.fileSize,
      width: media.width,
      height: media.height,
      caption: media.caption,
      challengeId: media.challengeId,
      momentId: media.momentId,
      takenAt: media.takenAt,
      uploadedAt: media.uploadedAt,
      processingStatus: media.processingStatus,
      guest: {
        id: guests.id,
        name: guests.name,
        avatarUrl: guests.avatarUrl,
      },
    })
    .from(media)
    .leftJoin(guests, eq(media.guestId, guests.id))
    .where(eq(media.id, mediaId))
    .then((rows) => rows[0] ?? null);

  if (!row) return null;
  const [enriched] = await enrichMedia([row], viewerGuestId);
  return enriched;
}
