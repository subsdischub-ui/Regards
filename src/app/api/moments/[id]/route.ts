import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { moments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/auth';
import { readJsonBody, asValidDate, asNonEmptyString } from '@/lib/validation';

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
  if (body.label !== undefined) updates.label = asNonEmptyString(body.label);
  if (body.startTime !== undefined) {
    const startTime = asValidDate(body.startTime);
    if (!startTime) {
      return NextResponse.json({ error: 'invalid startTime' }, { status: 400 });
    }
    updates.startTime = startTime;
  }
  if (body.endTime !== undefined) {
    const endTime = asValidDate(body.endTime);
    if (!endTime) {
      return NextResponse.json({ error: 'invalid endTime' }, { status: 400 });
    }
    updates.endTime = endTime;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 });
  }
  if (
    updates.startTime instanceof Date &&
    updates.endTime instanceof Date &&
    updates.startTime >= updates.endTime
  ) {
    return NextResponse.json(
      { error: 'startTime must be before endTime' },
      { status: 400 }
    );
  }

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
