import { NextResponse } from 'next/server';
import { getGuestId } from '@/lib/auth';
import { toggleReaction, getReactionCount } from '@/lib/db/queries/reactions';
import { broadcast } from '@/lib/sse';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mediaId } = await params;
  const body = await request.json().catch(() => ({}));
  const type = body.type || 'heart';

  const result = await toggleReaction(mediaId, guestId, type);
  const count = await getReactionCount(mediaId);

  broadcast('new_reaction', { mediaId, count });

  // Award points if reaction was added
  if (result.action === 'added') {
    try {
      const { awardReactionPoints } = await import('@/lib/points');
      await awardReactionPoints(mediaId);
    } catch {}
  }

  return NextResponse.json({ ...result, count });
}