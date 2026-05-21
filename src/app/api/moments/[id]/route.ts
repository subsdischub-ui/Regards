import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { moments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.label !== undefined) updates.label = body.label || null;
  if (body.startTime !== undefined) updates.startTime = new Date(body.startTime);
  if (body.endTime !== undefined) updates.endTime = new Date(body.endTime);

  const [updated] = await db
    .update(moments)
    .set(updates)
    .where(eq(moments.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await db.delete(moments).where(eq(moments.id, id));
  return NextResponse.json({ deleted: true });
}
