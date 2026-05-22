ALTER TABLE "media" ADD COLUMN "points_awarded" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill: every media already in 'done' was credited under the previous code
-- path. Mark it as awarded so crash-recovery never double-credits existing data.
-- Media still 'pending'/'processing'/'error' keep points_awarded = false and are
-- credited (once) when they next reach 'done'.
UPDATE "media" SET "points_awarded" = true WHERE "processing_status" = 'done';
