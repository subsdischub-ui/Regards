CREATE INDEX "idx_comments_media" ON "comments" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "idx_media_feed" ON "media" USING btree ("uploaded_at" DESC NULLS LAST) WHERE processing_status = 'done';--> statement-breakpoint
CREATE INDEX "idx_media_guest_uploaded" ON "media" USING btree ("guest_id","uploaded_at" DESC NULLS LAST);