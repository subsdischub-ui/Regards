import { db } from '@/lib/db';
import { comments, guests } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';

export async function createComment(data: {
  mediaId: string;
  guestId: string;
  content: string;
  parentId?: string;
}) {
  const [comment] = await db.insert(comments).values(data).returning();
  return comment;
}

export async function getComments(mediaId: string) {
  return db
    .select({
      id: comments.id,
      mediaId: comments.mediaId,
      parentId: comments.parentId,
      content: comments.content,
      createdAt: comments.createdAt,
      guest: {
        id: guests.id,
        name: guests.name,
        avatarUrl: guests.avatarUrl,
      },
    })
    .from(comments)
    .leftJoin(guests, eq(comments.guestId, guests.id))
    .where(eq(comments.mediaId, mediaId))
    .orderBy(asc(comments.createdAt));
}

export async function getCommentCount(mediaId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.mediaId, mediaId));
  return result[0]?.count ?? 0;
}