import { NextRequest, NextResponse } from 'next/server';
import { getFeedMedia } from '@/lib/db/queries/media';
import { getGuestId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
  const guestId = request.nextUrl.searchParams.get('guest') ?? undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10);
  const viewerGuestId = (await getGuestId()) ?? undefined;

  const result = await getFeedMedia({ cursor, limit, guestId, viewerGuestId });

  return NextResponse.json(result);
}
