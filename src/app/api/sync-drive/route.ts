import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { syncToDrive } from '@/lib/drive';

export async function POST() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await syncToDrive();
  return NextResponse.json(result);
}