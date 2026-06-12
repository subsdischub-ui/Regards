ALTER TABLE "media" ADD COLUMN "moment_id" uuid;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."moments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_moment" ON "media" USING btree ("moment_id");