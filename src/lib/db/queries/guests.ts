import { db } from '@/lib/db';
import { guests } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function createGuest(data: {
  name: string;
  relation?: string;
  avatarUrl?: string;
}) {
  const [guest] = await db.insert(guests).values(data).returning();
  return guest;
}

export async function getGuest(id: string) {
  return db.query.guests.findFirst({ where: eq(guests.id, id) });
}

export async function updateGuest(
  id: string,
  data: Partial<{ name: string; relation: string | null; avatarUrl: string | null }>,
) {
  const [guest] = await db.update(guests).set(data).where(eq(guests.id, id)).returning();
  return guest ?? null;
}

export async function getAllGuests() {
  return db.query.guests.findMany({ orderBy: (g, { desc }) => [desc(g.points)] });
}

export async function updateLastActive(id: string) {
  await db
    .update(guests)
    .set({ lastActiveAt: sql`now()` })
    .where(eq(guests.id, id));
}