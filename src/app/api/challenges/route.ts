import { NextResponse } from 'next/server';
import { getAllChallenges, getChallengeParticipations } from '@/lib/db/queries/challenges';
import { getGuestId, getAdminSession } from '@/lib/auth';
import { getCompletedChallengeIds } from '@/lib/db/queries/challenges';
import { db } from '@/lib/db';
import { challenges } from '@/lib/db/schema';

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

  const body = await request.json();
  const [challenge] = await db.insert(challenges).values({
    title: body.title,
    description: body.description,
    points: body.points || 30,
    unlockAt: body.unlockAt ? new Date(body.unlockAt) : null,
    sortOrder: body.sortOrder || 0,
    isActive: body.unlockAt ? false : true,
  }).returning();

  return NextResponse.json(challenge, { status: 201 });
}