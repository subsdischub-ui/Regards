import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { challenges } from '@/lib/db/schema';
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
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.points !== undefined) updates.points = Number(body.points);
  if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder);
  if (body.unlockAt !== undefined) {
    updates.unlockAt = body.unlockAt ? new Date(body.unlockAt) : null;
  }
  if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

  const [updated] = await db
    .update(challenges)
    .set(updates)
    .where(eq(challenges.id, id))
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
  await db.delete(challenges).where(eq(challenges.id, id));
  return NextResponse.json({ deleted: true });
}
