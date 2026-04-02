import { NextResponse } from 'next/server';
import { createGuest, getAllGuests } from '@/lib/db/queries/guests';
import { setGuestId } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const guest = await createGuest({
    name: body.name.trim(),
    relation: body.relation || null,
    avatarUrl: body.avatarUrl || null,
  });

  await setGuestId(guest.id);

  return NextResponse.json(guest, { status: 201 });
}

export async function GET() {
  const allGuests = await getAllGuests();
  return NextResponse.json(allGuests);
}