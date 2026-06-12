import { NextResponse } from 'next/server';
import { setGuestId } from '@/lib/auth';
import { getGuest, updateLastActive } from '@/lib/db/queries/guests';
import { readJsonBody } from '@/lib/validation';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Re-establish the httpOnly session cookie from the guest_id kept in
// localStorage. The cookie can be lost (Secure-flag mismatch over HTTP,
// browser cleanup, 30-day expiry) while localStorage survives — without
// this, a returning guest is forced through /join and gets a duplicate
// identity. No password by design: the whole app is open to wedding
// guests and a v4 UUID is not guessable.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const guestId = body?.guestId;

  if (typeof guestId !== 'string' || !UUID_RE.test(guestId)) {
    return NextResponse.json({ error: 'Valid guestId required' }, { status: 400 });
  }

  const guest = await getGuest(guestId);
  if (!guest) {
    return NextResponse.json({ error: 'Unknown guest' }, { status: 404 });
  }

  await setGuestId(guest.id);
  await updateLastActive(guest.id);

  return NextResponse.json(guest);
}
