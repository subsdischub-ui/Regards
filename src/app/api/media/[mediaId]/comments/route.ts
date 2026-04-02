import { NextResponse } from 'next/server';
import { getGuestId } from '@/lib/auth';
import { createComment, getComments, getCommentCount } from '@/lib/db/queries/comments';
import { broadcast } from '@/lib/sse';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const list = await getComments(mediaId);
  return NextResponse.json(list);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mediaId } = await params;
  const body = await request.json();

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 });
  }

  const comment = await createComment({
    mediaId,
    guestId,
    content: body.content.trim(),
    parentId: body.parentId || undefined,
  });

  const count = await getCommentCount(mediaId);
  broadcast('new_comment', { mediaId, count });

  // Award points
  try {
    const { awardCommentPoints } = await import('@/lib/points');
    await awardCommentPoints(guestId);
  } catch {}

  return NextResponse.json(comment, { status: 201 });
}