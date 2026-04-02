import { NextResponse } from 'next/server';
import { getMomentsWithMedia } from '@/lib/db/queries/moments';

export async function GET() {
  const moments = await getMomentsWithMedia();
  return NextResponse.json(moments);
}