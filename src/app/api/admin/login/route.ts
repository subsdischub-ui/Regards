import { NextResponse } from 'next/server';
import { setAdminSession } from '@/lib/auth';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await setAdminSession();
  return NextResponse.json({ ok: true });
}