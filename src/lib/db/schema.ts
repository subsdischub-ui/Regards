import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Guests ──────────────────────────────────────────────
export const guests = pgTable('guests', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  relation: text('relation'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
  points: integer('points').default(0).notNull(),
  badges: text('badges').array().default(sql`'{}'`).notNull(),
  driveFolderId: text('drive_folder_id'),
});

// ─── Challenges ──────────────────────────────────────────
export const challenges = pgTable('challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  points: integer('points').default(30).notNull(),
  unlockAt: timestamp('unlock_at', { withTimezone: true }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Media ───────────────────────────────────────────────
export const media = pgTable('media', {
  id: uuid('id').defaultRandom().primaryKey(),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'cascade' }).notNull(),
  fileUrl: text('file_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  // Compressed, web-optimized version for videos (H.264 720/1280p, faststart).
  // Served for playback instead of the multi-hundred-MB original.
  webUrl: text('web_url'),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size'),
  width: integer('width'),
  height: integer('height'),
  caption: text('caption'),
  challengeId: uuid('challenge_id').references(() => challenges.id, { onDelete: 'set null' }),
  momentId: uuid('moment_id').references(() => moments.id, { onDelete: 'set null' }),
  takenAt: timestamp('taken_at', { withTimezone: true }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  processingStatus: text('processing_status').default('pending').notNull(),
  // Atomically claimed by awardUploadPoints so a media can never be credited
  // twice (e.g. crash-recovery re-processing the same item).
  pointsAwarded: boolean('points_awarded').default(false).notNull(),
  driveSynced: boolean('drive_synced').default(false).notNull(),
  driveFileId: text('drive_file_id'),
}, (table) => [
  index('idx_media_taken_at').on(table.takenAt),
  index('idx_media_guest').on(table.guestId),
  index('idx_media_challenge').on(table.challengeId),
  index('idx_media_moment').on(table.momentId),
  index('idx_media_not_synced').on(table.driveSynced).where(sql`drive_synced = false`),
  index('idx_media_processing').on(table.processingStatus),
  // The feed sorts AND paginates on uploaded_at (desc) over processing_status='done'.
  // A partial index on uploaded_at lets Postgres satisfy both the ORDER BY and the
  // cursor range with a single index scan instead of a seq-scan + sort that grows
  // linearly with the media table.
  index('idx_media_feed').on(table.uploadedAt.desc()).where(sql`processing_status = 'done'`),
  // Guest-filtered feed: same access path, scoped to one guest.
  index('idx_media_guest_uploaded').on(table.guestId, table.uploadedAt.desc()),
]);

// ─── Reactions ───────────────────────────────────────────
export const reactions = pgTable('reactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaId: uuid('media_id').references(() => media.id, { onDelete: 'cascade' }).notNull(),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').default('heart').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_reaction_unique').on(table.mediaId, table.guestId, table.type),
]);

// ─── Comments ────────────────────────────────────────────
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaId: uuid('media_id').references(() => media.id, { onDelete: 'cascade' }).notNull(),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'cascade' }).notNull(),
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // The feed runs a count(*) GROUP BY media_id over this table for every page;
  // without an index on the FK it is a full table scan per feed request.
  index('idx_comments_media').on(table.mediaId),
]);

// ─── Guestbook (audio messages) ──────────────────────────
export const guestbookMessages = pgTable('guestbook_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'cascade' }).notNull(),
  audioUrl: text('audio_url').notNull(),
  duration: integer('duration'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Moments ─────────────────────────────────────────────
export const moments = pgTable('moments', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  autoGenerated: boolean('auto_generated').default(true).notNull(),
  driveFolderId: text('drive_folder_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Config ──────────────────────────────────────────────
export const config = pgTable('config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

import { relations } from 'drizzle-orm';

export const guestsRelations = relations(guests, ({ many }) => ({
  media: many(media),
  reactions: many(reactions),
  comments: many(comments),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  guest: one(guests, { fields: [media.guestId], references: [guests.id] }),
  challenge: one(challenges, { fields: [media.challengeId], references: [challenges.id] }),
  moment: one(moments, { fields: [media.momentId], references: [moments.id] }),
  reactions: many(reactions),
  comments: many(comments),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  media: one(media, { fields: [reactions.mediaId], references: [media.id] }),
  guest: one(guests, { fields: [reactions.guestId], references: [guests.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  media: one(media, { fields: [comments.mediaId], references: [media.id] }),
  guest: one(guests, { fields: [comments.guestId], references: [guests.id] }),
  parent: one(comments, { fields: [comments.parentId], references: [comments.id] }),
}));

export const guestbookMessagesRelations = relations(guestbookMessages, ({ one }) => ({
  guest: one(guests, { fields: [guestbookMessages.guestId], references: [guests.id] }),
}));
