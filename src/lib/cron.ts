import cron from 'node-cron';
import { db } from '@/lib/db';
import { challenges } from '@/lib/db/schema';
import { and, lte, eq, sql } from 'drizzle-orm';
import { broadcast } from '@/lib/sse';

export function startCronJobs() {
  console.log('[cron] Starting cron jobs...');

  // Unlock challenges every minute
  cron.schedule('* * * * *', async () => {
    try {
      const unlocked = await db
        .update(challenges)
        .set({ isActive: true })
        .where(
          and(
            eq(challenges.isActive, false),
            lte(challenges.unlockAt, sql`now()`),
          )
        )
        .returning();

      for (const challenge of unlocked) {
        console.log(`[cron] Unlocked challenge: ${challenge.title}`);
        broadcast('challenge_unlocked', {
          challengeId: challenge.id,
          title: challenge.title,
        });
      }
    } catch (err) {
      console.error('[cron] Challenge unlock error:', err);
    }
  });

  // Drive sync every 5 minutes (placeholder — implemented in Task 15)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { syncToDrive } = await import('@/lib/drive');
      await syncToDrive();
    } catch (err) {
      console.error('[cron] Drive sync error:', err);
    }
  });

  console.log('[cron] Cron jobs started.');
}