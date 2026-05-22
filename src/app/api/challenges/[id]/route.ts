import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { challenges } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/auth';
import { readJsonBody, asNonEmptyString, asValidDate, asFiniteInt } from '@/lib/validation';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = asNonEmptyString(body.title);
    if (!title) return NextResponse.json({ error: 'invalid title' }, { status: 400 });
    updates.title = title;
  }
  if (body.description !== undefined) {
    const description = asNonEmptyString(body.description);
    if (!description) {
      return NextResponse.json({ error: 'invalid description' }, { status: 400 });
    }
    updates.description = description;
  }
  if (body.points !== undefined) {
    const points = asFiniteInt(body.points);
    if (points === null) return NextResponse.json({ error: 'invalid points' }, { status: 400 });
    updates.points = points;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = asFiniteInt(body.sortOrder);
    if (sortOrder === null) {
      return NextResponse.json({ error: 'invalid sortOrder' }, { status: 400 });
    }
    updates.sortOrder = sortOrder;
  }
  if (body.unlockAt !== undefined) {
    if (body.unlockAt) {
      const unlockAt = asValidDate(body.unlockAt);
      if (!unlockAt) return NextResponse.json({ error: 'invalid unlockAt' }, { status: 400 });
      updates.unlockAt = unlockAt;
    } else {
      updates.unlockAt = null;
    }
  }
  if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 });
  }

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
