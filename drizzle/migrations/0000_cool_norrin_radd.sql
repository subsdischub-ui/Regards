CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"points" integer DEFAULT 30 NOT NULL,
	"unlock_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"relation" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"badges" text[] DEFAULT '{}' NOT NULL,
	"drive_folder_id" text
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"thumbnail_url" text,
	"file_type" text NOT NULL,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"caption" text,
	"challenge_id" uuid,
	"taken_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"drive_synced" boolean DEFAULT false NOT NULL,
	"drive_file_id" text
);
--> statement-breakpoint
CREATE TABLE "moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"auto_generated" boolean DEFAULT true NOT NULL,
	"drive_folder_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"type" text DEFAULT 'heart' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_taken_at" ON "media" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "idx_media_guest" ON "media" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "idx_media_challenge" ON "media" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_media_not_synced" ON "media" USING btree ("drive_synced") WHERE drive_synced = false;--> statement-breakpoint
CREATE INDEX "idx_media_processing" ON "media" USING btree ("processing_status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reaction_unique" ON "reactions" USING btree ("media_id","guest_id","type");