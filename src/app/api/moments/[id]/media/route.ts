import { NextResponse } from 'next/server';
import { getMomentMedia } from '@/lib/db/queries/moments';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getMomentMedia(id);
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}
