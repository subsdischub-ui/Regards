import { NextResponse } from 'next/server';
import { getGuestId } from '@/lib/auth';
import { getGuest, updateGuest } from '@/lib/db/queries/guests';

export async function GET() {
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guest = await getGuest(guestId);
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(guest);
}

export async function PATCH(request: Request) {
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: { name?: string; relation?: string | null } = {};

  if ('name' in body) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    updates.name = body.name.trim();
  }

  if ('relation' in body) {
    if (body.relation !== null && typeof body.relation !== 'string') {
      return NextResponse.json({ error: 'Invalid relation' }, { status: 400 });
    }
    updates.relation = body.relation || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const guest = await updateGuest(guestId, updates);
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(guest);
}
