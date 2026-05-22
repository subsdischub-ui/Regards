import { NextResponse } from 'next/server';
import { getAllChallenges, getChallengeParticipations } from '@/lib/db/queries/challenges';
import { getGuestId, getAdminSession } from '@/lib/auth';
import { getCompletedChallengeIds } from '@/lib/db/queries/challenges';
import { db } from '@/lib/db';
import { challenges } from '@/lib/db/schema';
import { readJsonBody, asNonEmptyString, asValidDate, asFiniteInt } from '@/lib/validation';

export async function GET() {
  const guestId = await getGuestId();
  const all = await getAllChallenges();
  const completed = guestId ? await getCompletedChallengeIds(guestId) : [];

  const withMeta = await Promise.all(
    all.map(async (c) => ({
      ...c,
      participations: await getChallengeParticipations(c.id),
      completed: completed.includes(c.id),
    }))
  );

  return NextResponse.json(withMeta);
}

export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = asNonEmptyString(body.title);
  const description = asNonEmptyString(body.description);
  if (!title || !description) {
    return NextResponse.json(
      { error: 'title and description are required' },
      { status: 400 },
    );
  }

  let unlockAt: Date | null = null;
  if (body.unlockAt) {
    unlockAt = asValidDate(body.unlockAt);
    if (!unlockAt) {
      return NextResponse.json({ error: 'invalid unlockAt' }, { status: 400 });
    }
  }

  const points = body.points === undefined ? 30 : asFiniteInt(body.points);
  if (points === null) {
    return NextResponse.json({ error: 'invalid points' }, { status: 400 });
  }

  const sortOrder = body.sortOrder === undefined ? 0 : asFiniteInt(body.sortOrder);
  if (sortOrder === null) {
    return NextResponse.json({ error: 'invalid sortOrder' }, { status: 400 });
  }

  const [challenge] = await db.insert(challenges).values({
    title,
    description,
    points,
    unlockAt,
    sortOrder,
    isActive: unlockAt ? false : true,
  }).returning();

  return NextResponse.json(challenge, { status: 201 });
}