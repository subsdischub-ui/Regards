# Regards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Regards", a PWA wedding photo-sharing app with gamification, real-time feed, and Google Drive sync, deployed via Docker on Dokploy.

**Architecture:** Monolithic Next.js 14+ (App Router) backed by PostgreSQL 16 (via Drizzle ORM) and MinIO (S3-compatible object storage). SSE for real-time updates. tus protocol for resumable uploads. node-cron for background sync to Google Drive. All 3 services (Next.js, PostgreSQL, MinIO) run as Docker containers orchestrated by Docker Compose.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, Drizzle ORM, PostgreSQL 16, MinIO, @tus/server + @tus/s3-store, sharp, exifr, ffmpeg, googleapis, node-cron, qrcode

**Spec:** `docs/superpowers/specs/2026-03-31-regards-design.md`

---

## File Structure

```
regards/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env.local                          # Local dev (gitignored)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── drizzle.config.ts
├── instrumentation.ts                  # node-cron init
├── public/
│   ├── manifest.json
│   └── sw.js
├── drizzle/
│   └── seed.ts                         # Seed data (challenges, moments, config)
├── src/
│   ├── middleware.ts                    # Guest auth + last_active_at + CORS
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                  # Root layout (fonts, metadata, theme)
│   │   ├── page.tsx                    # Welcome screen
│   │   ├── join/
│   │   │   └── page.tsx               # Guest onboarding
│   │   ├── (main)/                    # Route group: bottom nav layout
│   │   │   ├── layout.tsx             # BottomNav wrapper
│   │   │   ├── feed/
│   │   │   │   └── page.tsx           # Feed with clusters + avatar row
│   │   │   ├── challenges/
│   │   │   │   └── page.tsx
│   │   │   ├── upload/
│   │   │   │   └── page.tsx           # Multi-file upload with tus
│   │   │   ├── moments/
│   │   │   │   └── page.tsx           # Vertical timeline
│   │   │   └── leaderboard/
│   │   │       └── page.tsx
│   │   ├── media/
│   │   │   └── [mediaId]/
│   │   │       └── page.tsx           # Full-screen detail view
│   │   ├── admin/
│   │   │   ├── layout.tsx             # Admin auth gate
│   │   │   ├── page.tsx               # Stats dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── challenges/
│   │   │   │   └── page.tsx           # CRUD challenges
│   │   │   └── moments/
│   │   │       └── page.tsx           # CRUD moments
│   │   └── api/
│   │       ├── guests/
│   │       │   └── route.ts
│   │       ├── media/
│   │       │   ├── route.ts           # GET feed (paginated + clustered)
│   │       │   ├── [mediaId]/
│   │       │   │   ├── route.ts       # GET detail, DELETE
│   │       │   │   ├── reactions/
│   │       │   │   │   └── route.ts   # POST/DELETE toggle
│   │       │   │   └── comments/
│   │       │   │       └── route.ts   # POST/GET
│   │       │   └── file/
│   │       │       └── [...key]/
│   │       │           └── route.ts   # Presigned URL redirect
│   │       ├── upload/
│   │       │   └── tus/
│   │       │       └── [...path]/
│   │       │           └── route.ts   # tus endpoint
│   │       ├── challenges/
│   │       │   └── route.ts
│   │       ├── moments/
│   │       │   └── route.ts
│   │       ├── leaderboard/
│   │       │   └── route.ts
│   │       ├── sync-drive/
│   │       │   └── route.ts
│   │       └── sse/
│   │           └── route.ts
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts               # Drizzle client singleton
│   │   │   ├── schema.ts              # All table definitions
│   │   │   └── queries/
│   │   │       ├── guests.ts
│   │   │       ├── media.ts
│   │   │       ├── challenges.ts
│   │   │       ├── reactions.ts
│   │   │       ├── comments.ts
│   │   │       ├── moments.ts
│   │   │       └── config.ts
│   │   ├── minio.ts                   # MinIO S3 client
│   │   ├── sse.ts                     # SSE connection manager + broadcast
│   │   ├── cron.ts                    # Cron jobs (Drive sync + challenge unlock)
│   │   ├── drive.ts                   # Google Drive API helpers
│   │   ├── processing.ts             # Async media processing queue
│   │   ├── points.ts                  # Points calculation + badge checks
│   │   └── auth.ts                    # Cookie helpers (get/set guest_id)
│   ├── components/
│   │   ├── bottom-nav.tsx
│   │   ├── media-card.tsx             # Single photo card in feed
│   │   ├── cluster-card.tsx           # "Même moment" cluster
│   │   ├── avatar-row.tsx             # Horizontal avatar filter
│   │   ├── challenge-card.tsx
│   │   ├── moment-node.tsx            # Timeline node
│   │   ├── comment-thread.tsx
│   │   ├── reaction-button.tsx
│   │   ├── download-button.tsx
│   │   ├── upload-preview.tsx         # Grid preview with swipe captions
│   │   ├── toast.tsx                  # Badge/notification toasts
│   │   └── qr-generator.tsx           # QR code SVG component
│   └── hooks/
│       ├── use-sse.ts                 # EventSource hook
│       ├── use-guest.ts               # Current guest from cookie
│       └── use-infinite-feed.ts       # Infinite scroll + pagination
└── tests/
    ├── lib/
    │   ├── clustering.test.ts
    │   ├── points.test.ts
    │   └── processing.test.ts
    └── api/
        ├── guests.test.ts
        ├── media.test.ts
        ├── reactions.test.ts
        ├── comments.test.ts
        └── challenges.test.ts
```

---

## Phase 1 — Project Setup & Infrastructure

### Task 1: Initialize Next.js project with dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `.env.example`, `.env.local`, `.gitignore`

- [ ] **Step 1: Create Next.js project**

```bash
cd /c/Users/malac/Documents/Regards
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
```

Select defaults when prompted. This will scaffold the project in the current directory.

- [ ] **Step 2: Install all dependencies**

```bash
npm install drizzle-orm postgres @tus/server @tus/s3-store @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp exifr googleapis node-cron qrcode uuid
npm install -D drizzle-kit @types/node-cron @types/qrcode @types/uuid vitest
```

- [ ] **Step 3: Create .env.example and .env.local**

`.env.example`:
```env
# PostgreSQL
DATABASE_URL=postgresql://regards:regards@localhost:5432/regards

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=regards-access
MINIO_SECRET_KEY=regards-secret-key-change-me
MINIO_BUCKET=regards
MINIO_USE_SSL=false

# Google Drive
GOOGLE_SERVICE_ACCOUNT_KEY=

# Admin
ADMIN_PASSWORD=admin-change-me

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEDDING_DATE=2026-05-23
```

`.env.local` — copy of `.env.example` with same values (for local dev).

- [ ] **Step 4: Configure next.config.ts**

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Set up Tailwind with wedding theme**

`tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5B6B52',
        secondary: '#C4A882',
        accent: '#7B4F5C',
        bg: {
          DEFAULT: '#FAF8F5',
          card: '#FFFFFF',
          secondary: '#F3F0EB',
        },
        text: {
          DEFAULT: '#2C2A28',
          secondary: '#6B6560',
          tertiary: '#A39E98',
        },
        border: 'rgba(0,0,0,0.08)',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
```

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=DM+Sans:wght@400;500&display=swap');

body {
  font-family: 'DM Sans', sans-serif;
  background-color: #FAF8F5;
  color: #2C2A28;
}
```

- [ ] **Step 6: Create root layout**

`src/app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Regards — Malachie & Jessica',
  description: 'Partagez vos regards sur notre mariage',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#5B6B52',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-bg antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify the app starts**

```bash
npm run dev
```

Expected: App starts on http://localhost:3000 with default page.

- [ ] **Step 8: Commit**

```bash
git init
echo "node_modules\n.next\n.env.local\n.env" > .gitignore
git add -A
git commit -m "feat: initialize Next.js project with Tailwind wedding theme"
```

---

### Task 2: Docker Compose + Dockerfile

**Files:**
- Create: `docker-compose.yml`, `Dockerfile`, `docker-compose.dev.yml`

- [ ] **Step 1: Create docker-compose.dev.yml for local development**

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: regards
      POSTGRES_PASSWORD: regards
      POSTGRES_DB: regards
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: regards-access
      MINIO_ROOT_PASSWORD: regards-secret-key-change-me
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 2: Create production Dockerfile**

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install ffmpeg for video thumbnails
RUN apk add --no-cache ffmpeg

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

Update `next.config.ts` to add `output: 'standalone'`:
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  // ... rest stays the same
};
```

- [ ] **Step 3: Create production docker-compose.yml**

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://regards:${POSTGRES_PASSWORD}@postgres:5432/regards
      MINIO_ENDPOINT: minio
      MINIO_PORT: "9000"
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_BUCKET: regards
      MINIO_USE_SSL: "false"
      GOOGLE_SERVICE_ACCOUNT_KEY: ${GOOGLE_SERVICE_ACCOUNT_KEY}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      NEXT_PUBLIC_WEDDING_DATE: "2026-05-23"
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_started
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: regards
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: regards
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U regards"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - miniodata:/data
    restart: unless-stopped

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 4: Start dev services and verify**

```bash
docker compose -f docker-compose.dev.yml up -d
```

Verify PostgreSQL:
```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U regards -c "SELECT 1"
```
Expected: Returns `1`.

Verify MinIO: open http://localhost:9001 in browser, login with `regards-access` / `regards-secret-key-change-me`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml Dockerfile next.config.ts
git commit -m "feat: add Docker Compose (dev + prod) and Dockerfile with ffmpeg"
```

---

### Task 3: Drizzle schema + MinIO client

**Files:**
- Create: `drizzle.config.ts`, `src/lib/db/schema.ts`, `src/lib/db/index.ts`, `src/lib/minio.ts`, `drizzle/seed.ts`

- [ ] **Step 1: Create Drizzle config**

`drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 2: Create full database schema**

`src/lib/db/schema.ts`:
```typescript
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

export const media = pgTable('media', {
  id: uuid('id').defaultRandom().primaryKey(),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'cascade' }).notNull(),
  fileUrl: text('file_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size'),
  width: integer('width'),
  height: integer('height'),
  caption: text('caption'),
  challengeId: uuid('challenge_id').references(() => challenges.id, { onDelete: 'set null' }),
  takenAt: timestamp('taken_at', { withTimezone: true }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  processingStatus: text('processing_status').default('pending').notNull(),
  driveSynced: boolean('drive_synced').default(false).notNull(),
  driveFileId: text('drive_file_id'),
}, (table) => [
  index('idx_media_taken_at').on(table.takenAt),
  index('idx_media_guest').on(table.guestId),
  index('idx_media_challenge').on(table.challengeId),
  index('idx_media_not_synced').on(table.driveSynced).where(sql`drive_synced = false`),
  index('idx_media_processing').on(table.processingStatus),
]);

export const reactions = pgTable('reactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaId: uuid('media_id').references(() => media.id, { onDelete: 'cascade' }).notNull(),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').default('heart').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_reaction_unique').on(table.mediaId, table.guestId, table.type),
]);

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaId: uuid('media_id').references(() => media.id, { onDelete: 'cascade' }).notNull(),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'cascade' }).notNull(),
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const moments = pgTable('moments', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  autoGenerated: boolean('auto_generated').default(true).notNull(),
  driveFolderId: text('drive_folder_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const config = pgTable('config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});
```

- [ ] **Step 3: Create Drizzle client singleton**

`src/lib/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

- [ ] **Step 4: Generate and push migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

Expected: Tables created in PostgreSQL. Verify:
```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U regards -c "\dt"
```
Expected: Lists `guests`, `media`, `challenges`, `reactions`, `comments`, `moments`, `config`.

- [ ] **Step 5: Create seed script**

`drizzle/seed.ts`:
```typescript
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { challenges, moments, config } from '../src/lib/db/schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function seed() {
  console.log('Seeding challenges...');
  await db.insert(challenges).values([
    {
      title: 'La cérémonie vue de votre place',
      description: 'Montrez-nous la cérémonie telle que vous la voyez depuis votre siège',
      points: 30,
      unlockAt: new Date('2026-05-23T14:30:00Z'), // 16h30 CEST
      sortOrder: 1,
      isActive: false,
    },
    {
      title: 'La première danse',
      description: 'Capturez la première danse des mariés depuis votre angle',
      points: 50,
      sortOrder: 2,
      isActive: true,
    },
    {
      title: "Selfie avec un(e) inconnu(e)",
      description: "Faites connaissance avec quelqu'un de l'autre famille et prenez un selfie ensemble",
      points: 30,
      sortOrder: 3,
      isActive: true,
    },
    {
      title: "Le dancefloor vu d'en haut",
      description: 'Trouvez un point de vue en hauteur pour photographier la piste de danse',
      points: 40,
      sortOrder: 4,
      isActive: true,
    },
    {
      title: 'Le moment le plus émouvant',
      description: 'Capturez LE moment qui vous a fait monter les larmes',
      points: 100,
      sortOrder: 5,
      isActive: true,
    },
    {
      title: 'Le détail déco le plus original',
      description: 'La déco est pleine de surprises... Trouvez la plus originale',
      points: 20,
      sortOrder: 6,
      isActive: true,
    },
    {
      title: 'Les enfants en action',
      description: 'Les enfants sont les vraies stars — immortalisez leurs bêtises',
      points: 30,
      sortOrder: 7,
      isActive: true,
    },
    {
      title: 'Le plat que vous avez préféré',
      description: 'Photographiez votre plat préféré du repas',
      points: 20,
      unlockAt: new Date('2026-05-23T17:00:00Z'), // 19h00 CEST
      sortOrder: 8,
      isActive: false,
    },
    {
      title: 'La piste à son apogée',
      description: 'Le moment où la piste de danse est la plus remplie',
      points: 50,
      unlockAt: new Date('2026-05-23T20:00:00Z'), // 22h00 CEST
      sortOrder: 9,
      isActive: false,
    },
    {
      title: 'Le dernier debout',
      description: 'Qui sera le dernier sur la piste ? Prouvez-le !',
      points: 100,
      unlockAt: new Date('2026-05-23T22:00:00Z'), // 00h00 CEST next day
      sortOrder: 10,
      isActive: false,
    },
  ]);

  console.log('Seeding moments...');
  await db.insert(moments).values([
    {
      label: 'Cérémonie',
      startTime: new Date('2026-05-23T14:30:00Z'),
      endTime: new Date('2026-05-23T15:15:00Z'),
      autoGenerated: false,
    },
    {
      label: 'Photos de groupe',
      startTime: new Date('2026-05-23T15:15:00Z'),
      endTime: new Date('2026-05-23T16:00:00Z'),
      autoGenerated: false,
    },
    {
      label: 'Cocktail',
      startTime: new Date('2026-05-23T16:00:00Z'),
      endTime: new Date('2026-05-23T17:30:00Z'),
      autoGenerated: false,
    },
    {
      label: 'Dîner',
      startTime: new Date('2026-05-23T17:30:00Z'),
      endTime: new Date('2026-05-23T19:30:00Z'),
      autoGenerated: false,
    },
    {
      label: 'Soirée dansante',
      startTime: new Date('2026-05-23T19:30:00Z'),
      endTime: new Date('2026-05-24T02:00:00Z'),
      autoGenerated: false,
    },
  ]);

  console.log('Seeding config...');
  await db.insert(config).values([
    {
      key: 'wedding',
      value: { groom: 'Malachie', bride: 'Jessica', date: '2026-05-23', city: 'Nantes' },
    },
    {
      key: 'theme',
      value: { primary: '#5B6B52', secondary: '#C4A882', accent: '#7B4F5C', bg: '#FAF8F5' },
    },
    {
      key: 'drive',
      value: { folder_id: '', all_moments_folder_id: '' },
    },
  ]);

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

Add to `package.json` scripts:
```json
"db:generate": "drizzle-kit generate",
"db:push": "drizzle-kit push",
"db:seed": "npx tsx drizzle/seed.ts"
```

- [ ] **Step 6: Create MinIO client**

`src/lib/minio.ts`:
```typescript
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  endpoint: `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
});

export const BUCKET = process.env.MINIO_BUCKET || 'regards';

export async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" created.`);
  }
}
```

- [ ] **Step 7: Run seed and verify**

```bash
npm run db:seed
```

Expected: "Seed complete!" — verify with:
```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U regards -c "SELECT title FROM challenges ORDER BY sort_order"
```
Expected: Lists 10 challenges.

- [ ] **Step 8: Commit**

```bash
git add drizzle.config.ts src/lib/db/ src/lib/minio.ts drizzle/ package.json
git commit -m "feat: add Drizzle schema, MinIO client, and seed data"
```

---

## Phase 2 — Auth & Onboarding

### Task 4: Guest auth (cookies, middleware)

**Files:**
- Create: `src/lib/auth.ts`, `src/middleware.ts`
- Test: `tests/lib/auth.test.ts`

- [ ] **Step 1: Create auth helpers**

`src/lib/auth.ts`:
```typescript
import { cookies } from 'next/headers';

const GUEST_COOKIE = 'guest_id';
const ADMIN_COOKIE = 'admin_session';

export async function getGuestId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_COOKIE)?.value ?? null;
}

export async function setGuestId(guestId: string) {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === 'authenticated';
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}
```

- [ ] **Step 2: Create middleware**

`src/middleware.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/feed', '/upload', '/challenges', '/moments', '/leaderboard', '/media'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // CORS
  const origin = request.headers.get('origin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && origin && origin !== appUrl) {
    return new NextResponse(null, { status: 403 });
  }

  // Guest auth check for protected pages
  const guestId = request.cookies.get('guest_id')?.value;

  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p)) && !guestId) {
    return NextResponse.redirect(new URL('/join', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/feed/:path*',
    '/upload/:path*',
    '/challenges/:path*',
    '/moments/:path*',
    '/leaderboard/:path*',
    '/media/:path*',
  ],
};
```

Note: `last_active_at` update is done in the API routes that read `guest_id`, not in Edge middleware (which can't access the database).

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts src/middleware.ts
git commit -m "feat: add guest auth cookies and route protection middleware"
```

---

### Task 5: Welcome page + Join page + Guests API

**Files:**
- Create: `src/app/page.tsx`, `src/app/join/page.tsx`, `src/app/api/guests/route.ts`, `src/lib/db/queries/guests.ts`

- [ ] **Step 1: Create guests query helpers**

`src/lib/db/queries/guests.ts`:
```typescript
import { db } from '@/lib/db';
import { guests } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function createGuest(data: {
  name: string;
  relation?: string;
  avatarUrl?: string;
}) {
  const [guest] = await db.insert(guests).values(data).returning();
  return guest;
}

export async function getGuest(id: string) {
  return db.query.guests.findFirst({ where: eq(guests.id, id) });
}

export async function getAllGuests() {
  return db.query.guests.findMany({ orderBy: (g, { desc }) => [desc(g.points)] });
}

export async function updateLastActive(id: string) {
  await db
    .update(guests)
    .set({ lastActiveAt: sql`now()` })
    .where(eq(guests.id, id));
}
```

- [ ] **Step 2: Create guests API route**

`src/app/api/guests/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createGuest, getAllGuests } from '@/lib/db/queries/guests';
import { setGuestId } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const guest = await createGuest({
    name: body.name.trim(),
    relation: body.relation || null,
    avatarUrl: body.avatarUrl || null,
  });

  await setGuestId(guest.id);

  return NextResponse.json(guest, { status: 201 });
}

export async function GET() {
  const allGuests = await getAllGuests();
  return NextResponse.json(allGuests);
}
```

- [ ] **Step 3: Create Welcome page**

`src/app/page.tsx`:
```tsx
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-4 pt-8">
        {/* Monogram */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-secondary">
          <span className="font-serif text-[22px] text-secondary">M&J</span>
        </div>

        <h1 className="text-center font-serif text-[26px] font-medium leading-tight">
          Malachie & Jessica
        </h1>
        <p className="mt-1 text-[13px] tracking-wide text-secondary">
          23 mai 2026 &middot; Nantes
        </p>

        <div className="my-6 h-px w-8 bg-secondary/50" />

        <p className="font-serif text-lg">Regards</p>
        <p className="mt-2 max-w-[280px] text-center text-sm leading-relaxed text-text-secondary">
          Vivez le mariage à travers les yeux de chacun. Partagez vos photos,
          relevez des défis, et découvrez la journée sous tous les angles.
        </p>
      </div>

      <div className="px-6 pb-6">
        <Link
          href="/join"
          className="block w-full rounded-lg bg-primary py-3.5 text-center text-[15px] font-medium text-white"
        >
          Rejoindre le mariage
        </Link>
        <p className="mt-2.5 text-center text-[11px] text-text-tertiary">
          Aucun compte &middot; Aucune app à télécharger
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Join page**

`src/app/join/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const RELATIONS = [
  { value: 'ami_mariee', label: 'Ami(e) de la mariée' },
  { value: 'famille_marie', label: 'Famille du marié' },
  { value: 'famille_mariee', label: 'Famille de la mariée' },
  { value: 'ami_marie', label: 'Ami(e) du marié' },
  { value: 'collegue', label: 'Collègue' },
  { value: 'autre', label: 'Autre' },
];

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), relation }),
      });

      if (res.ok) {
        // Cookie is set server-side, also store in localStorage as fallback
        const guest = await res.json();
        localStorage.setItem('guest_id', guest.id);
        localStorage.setItem('guest_name', guest.name);
        router.push('/feed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <button onClick={() => router.back()} className="text-lg text-text-secondary">
          &larr;
        </button>
        <h1 className="text-base font-medium">Qui êtes-vous ?</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 px-6 pt-6">
          {/* Name */}
          <div>
            <label className="mb-2 block text-[13px] text-text-secondary">Votre prénom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sophie"
              className="w-full rounded-lg border border-border bg-white px-4 py-3 text-[15px] outline-none focus:border-primary"
              required
            />
          </div>

          {/* Relation */}
          <div>
            <label className="mb-2 block text-[13px] text-text-secondary">
              Votre lien avec les mariés
            </label>
            <div className="flex flex-wrap gap-2">
              {RELATIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRelation(r.value)}
                  className={`rounded-full px-3.5 py-2 text-[13px] transition-colors ${
                    relation === r.value
                      ? 'bg-primary text-white'
                      : 'border border-border text-text-secondary'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selfie placeholder — will be enhanced later */}
          <div>
            <label className="mb-2 block text-[13px] text-text-secondary">
              Votre selfie{' '}
              <span className="text-text-tertiary">(optionnel)</span>
            </label>
            <div className="flex items-center gap-3.5 rounded-lg bg-bg-secondary p-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-secondary/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9A8872" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Prendre un selfie</p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Optionnel &middot; aide les autres à vous identifier
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full rounded-lg bg-primary py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Chargement...' : "C'est parti !"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Verify end-to-end onboarding flow**

```bash
npm run dev
```

1. Open http://localhost:3000 — Welcome page should render
2. Click "Rejoindre le mariage" → navigates to /join
3. Enter a name, select a relation, click "C'est parti !"
4. Should redirect to /feed (will be 404 for now, that's expected)
5. Check the cookie is set: open DevTools → Application → Cookies → `guest_id` should exist

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/join/ src/app/api/guests/ src/lib/db/queries/guests.ts
git commit -m "feat: add Welcome page, Join page, and Guests API"
```

---

## Phase 3 — Upload & Media Processing

### Task 6: tus upload endpoint

**Files:**
- Create: `src/app/api/upload/tus/[...path]/route.ts`

- [ ] **Step 1: Create tus route handler**

`src/app/api/upload/tus/[...path]/route.ts`:
```typescript
import { Server } from '@tus/server';
import { S3Store } from '@tus/s3-store';
import { s3Client, BUCKET, ensureBucket } from '@/lib/minio';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { enqueueProcessing } from '@/lib/processing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let tusServer: Server | null = null;

async function getTusServer() {
  if (tusServer) return tusServer;

  await ensureBucket();

  const store = new S3Store({
    s3ClientConfig: {
      endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true,
    },
    bucket: BUCKET,
    partSize: 8 * 1024 * 1024, // 8MB parts
  });

  tusServer = new Server({
    path: '/api/upload/tus',
    datastore: store,
    respectForwardedHeaders: true,
    async onUploadFinish(_req, res, upload) {
      const metadata = upload.metadata;
      const guestId = metadata?.guest_id;
      const caption = metadata?.caption || null;
      const challengeId = metadata?.challenge_id || null;
      const fileType = metadata?.filetype || 'application/octet-stream';
      const fileName = metadata?.filename || 'unknown';

      if (!guestId) {
        throw { status_code: 400, body: 'guest_id metadata required' };
      }

      // Insert media record
      const fileUrl = `media/originals/${upload.id}`;
      const [record] = await db.insert(media).values({
        guestId,
        fileUrl,
        fileType,
        fileSize: upload.size ? Number(upload.size) : null,
        caption,
        challengeId: challengeId || null,
        processingStatus: 'pending',
      }).returning();

      // Queue async processing (thumbnail, EXIF, etc.)
      enqueueProcessing(record.id, fileUrl, fileType);

      return res;
    },
  });

  return tusServer;
}

async function handleTus(req: Request) {
  const server = await getTusServer();

  // Convert Web Request to Node-compatible format
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const body = req.body;

  return new Promise<Response>((resolve) => {
    const nodeReq = {
      method: req.method,
      url: new URL(req.url).pathname,
      headers: Object.fromEntries(req.headers.entries()),
      on: (event: string, cb: (chunk?: Uint8Array) => void) => {
        if (event === 'data' && body) {
          const reader = body.getReader();
          (async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              cb(value);
            }
          })();
        }
        if (event === 'end' && body) {
          body.getReader().closed.then(() => cb());
        }
      },
    };

    const headers: Record<string, string> = {};
    let statusCode = 200;

    const nodeRes = {
      setHeader: (key: string, value: string) => { headers[key] = value; },
      getHeader: (key: string) => headers[key],
      writeHead: (code: number, hdrs?: Record<string, string>) => {
        statusCode = code;
        if (hdrs) Object.assign(headers, hdrs);
      },
      end: (body?: string) => {
        resolve(new Response(body || null, { status: statusCode, headers }));
      },
    };

    server.handle(nodeReq as any, nodeRes as any);
  });
}

export const POST = handleTus;
export const PATCH = handleTus;
export const HEAD = handleTus;
export const OPTIONS = handleTus;
export const DELETE = handleTus;
```

**Note:** The tus-Node.js integration with Next.js App Router requires a compatibility shim. If `@tus/server` v2+ provides native Web API support, simplify this. Otherwise, this shim converts between Web Request/Response and the Node.js req/res that tus expects.

- [ ] **Step 2: Create processing queue stub**

`src/lib/processing.ts`:
```typescript
type ProcessingJob = {
  mediaId: string;
  fileUrl: string;
  fileType: string;
};

const queue: ProcessingJob[] = [];
let isProcessing = false;

export function enqueueProcessing(mediaId: string, fileUrl: string, fileType: string) {
  queue.push({ mediaId, fileUrl, fileType });
  if (!isProcessing) {
    processNext();
  }
}

async function processNext() {
  if (queue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const job = queue.shift()!;

  try {
    await processMedia(job);
  } catch (err) {
    console.error(`Processing failed for ${job.mediaId}:`, err);
    // Update status to 'error'
    const { db } = await import('@/lib/db');
    const { media } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(media).set({ processingStatus: 'error' }).where(eq(media.id, job.mediaId));
  }

  // Process next in queue
  processNext();
}

async function processMedia(job: ProcessingJob) {
  const { db } = await import('@/lib/db');
  const { media } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { s3Client, BUCKET } = await import('@/lib/minio');
  const sharp = (await import('sharp')).default;

  await db.update(media).set({ processingStatus: 'processing' }).where(eq(media.id, job.mediaId));

  // Download from MinIO
  const obj = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: job.fileUrl }));
  const bodyBytes = await obj.Body!.transformToByteArray();
  const buffer = Buffer.from(bodyBytes);

  const updates: Record<string, any> = {};

  const isVideo = job.fileType.startsWith('video/');
  const isImage = job.fileType.startsWith('image/');

  // Extract EXIF from images
  if (isImage) {
    try {
      const exifr = (await import('exifr')).default;
      const exif = await exifr.parse(buffer, ['DateTimeOriginal', 'ImageWidth', 'ImageHeight']);
      if (exif?.DateTimeOriginal) {
        updates.takenAt = new Date(exif.DateTimeOriginal);
      }
      if (exif?.ImageWidth) updates.width = exif.ImageWidth;
      if (exif?.ImageHeight) updates.height = exif.ImageHeight;
    } catch {
      // EXIF extraction failed, continue without it
    }

    // Generate thumbnail
    const thumbnail = await sharp(buffer)
      .resize(800, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailKey = `media/thumbnails/${job.mediaId}.jpg`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: 'image/jpeg',
    }));
    updates.thumbnailUrl = thumbnailKey;

    // Get dimensions from sharp if not from EXIF
    if (!updates.width) {
      const meta = await sharp(buffer).metadata();
      updates.width = meta.width;
      updates.height = meta.height;
    }
  }

  // Generate video thumbnail via ffmpeg
  if (isVideo) {
    try {
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');

      const tmpInput = path.join(os.tmpdir(), `${job.mediaId}-input`);
      const tmpOutput = path.join(os.tmpdir(), `${job.mediaId}-thumb.jpg`);

      fs.writeFileSync(tmpInput, buffer);
      execSync(`ffmpeg -i "${tmpInput}" -vframes 1 -q:v 2 -vf "scale=800:-1" "${tmpOutput}" -y`, {
        timeout: 30000,
      });

      const thumbnailBuffer = fs.readFileSync(tmpOutput);
      const thumbnailKey = `media/thumbnails/${job.mediaId}.jpg`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      }));
      updates.thumbnailUrl = thumbnailKey;

      // Cleanup temp files
      fs.unlinkSync(tmpInput);
      fs.unlinkSync(tmpOutput);
    } catch (err) {
      console.error(`Video thumbnail failed for ${job.mediaId}:`, err);
    }

    // Use upload time as taken_at for videos
    updates.takenAt = new Date();
  }

  // Fallback: if no takenAt was extracted, use now
  if (!updates.takenAt) {
    updates.takenAt = new Date();
  }

  // Mark as done
  updates.processingStatus = 'done';
  await db.update(media).set(updates).where(eq(media.id, job.mediaId));

  // Broadcast SSE event
  const { broadcast } = await import('@/lib/sse');
  const record = await db.query.media.findFirst({
    where: eq(media.id, job.mediaId),
    with: { guest: true },
  });
  // SSE will be implemented in Task 9
  try {
    broadcast('new_media', {
      mediaId: job.mediaId,
      guestName: record?.guest?.name,
      thumbnailUrl: updates.thumbnailUrl,
    });
  } catch {
    // SSE not yet initialized
  }

  // Calculate points (will be implemented in Task 14)
  try {
    const { awardUploadPoints } = await import('@/lib/points');
    await awardUploadPoints(job.mediaId);
  } catch {
    // Points system not yet initialized
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/ src/lib/processing.ts
git commit -m "feat: add tus upload endpoint with async media processing queue"
```

---

### Task 7: Media serving API (presigned URLs, download)

**Files:**
- Create: `src/app/api/media/file/[...key]/route.ts`

- [ ] **Step 1: Create file serving route**

`src/app/api/media/file/[...key]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET } from '@/lib/minio';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const fileKey = key.join('/');
  const download = request.nextUrl.searchParams.get('download') === 'true';

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      ...(download && {
        ResponseContentDisposition: `attachment; filename="${fileKey.split('/').pop()}"`,
      }),
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

    return NextResponse.redirect(signedUrl, 302);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/media/file/
git commit -m "feat: add media file serving with presigned URLs and download support"
```

---

## Phase 4 — Feed & Real-time

### Task 8: SSE broadcast manager

**Files:**
- Create: `src/lib/sse.ts`, `src/app/api/sse/route.ts`

- [ ] **Step 1: Create SSE manager**

`src/lib/sse.ts`:
```typescript
type SSEConnection = {
  controller: ReadableStreamDefaultController;
  guestId: string;
};

const connections = new Map<string, SSEConnection>();
let eventCounter = 0;

export function addConnection(id: string, controller: ReadableStreamDefaultController, guestId: string) {
  connections.set(id, { controller, guestId });
}

export function removeConnection(id: string) {
  connections.delete(id);
}

export function broadcast(event: string, data: Record<string, any>) {
  eventCounter++;
  const message = `id: ${eventCounter}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);

  for (const [id, conn] of connections) {
    try {
      conn.controller.enqueue(encoded);
    } catch {
      connections.delete(id);
    }
  }
}

export function getConnectionCount() {
  return connections.size;
}
```

- [ ] **Step 2: Create SSE endpoint**

`src/app/api/sse/route.ts`:
```typescript
import { addConnection, removeConnection } from '@/lib/sse';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guestId = new URL(request.url).searchParams.get('guest_id') || 'anonymous';
  const connectionId = uuid();

  const stream = new ReadableStream({
    start(controller) {
      addConnection(connectionId, controller, guestId);

      // Send initial heartbeat
      const heartbeat = new TextEncoder().encode(': heartbeat\n\n');
      controller.enqueue(heartbeat);

      // Keepalive every 30 seconds
      const interval = setInterval(() => {
        try {
          controller.enqueue(heartbeat);
        } catch {
          clearInterval(interval);
          removeConnection(connectionId);
        }
      }, 30000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        removeConnection(connectionId);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      removeConnection(connectionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

- [ ] **Step 3: Create SSE client hook**

`src/hooks/use-sse.ts`:
```typescript
'use client';

import { useEffect, useRef, useCallback } from 'react';

type SSEHandler = (data: any) => void;

export function useSSE(handlers: Record<string, SSEHandler>) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const guestId = localStorage.getItem('guest_id') || '';
    const es = new EventSource(`/api/sse?guest_id=${guestId}`);
    eventSourceRef.current = es;

    for (const event of Object.keys(handlersRef.current)) {
      es.addEventListener(event, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current[event]?.(data);
        } catch {}
      });
    }

    es.onerror = () => {
      // EventSource auto-reconnects, nothing to do
    };

    return () => {
      es.close();
    };
  }, []);

  return eventSourceRef;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/sse.ts src/app/api/sse/ src/hooks/use-sse.ts
git commit -m "feat: add SSE broadcast manager, endpoint, and client hook"
```

---

### Task 9: Feed API with clustering

**Files:**
- Create: `src/app/api/media/route.ts`, `src/lib/db/queries/media.ts`, `tests/lib/clustering.test.ts`

- [ ] **Step 1: Write clustering test**

`tests/lib/clustering.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { clusterMedia } from '@/lib/db/queries/media';

const makeMedia = (id: string, guestId: string, takenAt: string) => ({
  id,
  guestId,
  takenAt: new Date(takenAt),
  fileUrl: `media/originals/${id}.jpg`,
  thumbnailUrl: `media/thumbnails/${id}.jpg`,
  fileType: 'image/jpeg',
  caption: null,
  uploadedAt: new Date(),
  processingStatus: 'done' as const,
  fileSize: 1000,
  width: 800,
  height: 600,
  challengeId: null,
  driveSynced: false,
  driveFileId: null,
  guest: { id: guestId, name: `Guest ${guestId}`, avatarUrl: null },
});

describe('clusterMedia', () => {
  it('returns single items when no clusters possible', () => {
    const items = [
      makeMedia('1', 'a', '2026-05-23T16:00:00Z'),
      makeMedia('2', 'a', '2026-05-23T16:01:00Z'), // same guest, no cluster
    ];
    const result = clusterMedia(items);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.type === 'single')).toBe(true);
  });

  it('clusters photos from different guests within 2 minutes', () => {
    const items = [
      makeMedia('1', 'a', '2026-05-23T16:00:00Z'),
      makeMedia('2', 'b', '2026-05-23T16:01:30Z'), // different guest, within 2 min
    ];
    const result = clusterMedia(items);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('cluster');
    if (result[0].type === 'cluster') {
      expect(result[0].items).toHaveLength(2);
    }
  });

  it('does not cluster photos more than 2 minutes apart', () => {
    const items = [
      makeMedia('1', 'a', '2026-05-23T16:00:00Z'),
      makeMedia('2', 'b', '2026-05-23T16:03:00Z'), // 3 min apart
    ];
    const result = clusterMedia(items);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.type === 'single')).toBe(true);
  });

  it('mixes clusters and singles correctly', () => {
    const items = [
      makeMedia('1', 'a', '2026-05-23T16:00:00Z'),
      makeMedia('2', 'b', '2026-05-23T16:01:00Z'),
      makeMedia('3', 'c', '2026-05-23T16:01:30Z'),
      makeMedia('4', 'a', '2026-05-23T17:00:00Z'), // far away, single
    ];
    const result = clusterMedia(items);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('cluster');
    expect(result[1].type).toBe('single');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Add vitest config to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```bash
npm test -- tests/lib/clustering.test.ts
```
Expected: FAIL — `clusterMedia` not found.

- [ ] **Step 3: Implement media queries with clustering**

`src/lib/db/queries/media.ts`:
```typescript
import { db } from '@/lib/db';
import { media, guests } from '@/lib/db/schema';
import { eq, desc, and, sql, lt } from 'drizzle-orm';

type MediaWithGuest = typeof media.$inferSelect & {
  guest: Pick<typeof guests.$inferSelect, 'id' | 'name' | 'avatarUrl'> | null;
};

export type FeedItem =
  | { type: 'single'; item: MediaWithGuest }
  | { type: 'cluster'; items: MediaWithGuest[]; time: Date };

export function clusterMedia(items: MediaWithGuest[]): FeedItem[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) => (a.takenAt?.getTime() ?? 0) - (b.takenAt?.getTime() ?? 0)
  );

  const results: FeedItem[] = [];
  let current: MediaWithGuest[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const curr = sorted[i];
    const diffMs =
      (curr.takenAt?.getTime() ?? 0) - (prev.takenAt?.getTime() ?? 0);
    const differentGuest = curr.guestId !== prev.guestId;

    if (diffMs <= 120_000 && differentGuest) {
      current.push(curr);
    } else {
      flush(current, results);
      current = [curr];
    }
  }
  flush(current, results);

  // Sort results by time descending (newest first)
  return results.sort((a, b) => {
    const timeA = a.type === 'cluster' ? a.time.getTime() : (a.item.takenAt?.getTime() ?? 0);
    const timeB = b.type === 'cluster' ? b.time.getTime() : (b.item.takenAt?.getTime() ?? 0);
    return timeB - timeA;
  });
}

function flush(group: MediaWithGuest[], results: FeedItem[]) {
  if (group.length >= 2) {
    results.push({
      type: 'cluster',
      items: group,
      time: group[0].takenAt ?? group[0].uploadedAt,
    });
  } else {
    results.push({ type: 'single', item: group[0] });
  }
}

export async function getFeedMedia(options: {
  cursor?: string;
  limit?: number;
  guestId?: string;
}) {
  const { cursor, limit = 20, guestId } = options;

  const conditions = [eq(media.processingStatus, 'done')];
  if (guestId) {
    conditions.push(eq(media.guestId, guestId));
  }
  if (cursor) {
    conditions.push(lt(media.uploadedAt, new Date(cursor)));
  }

  const items = await db
    .select({
      id: media.id,
      guestId: media.guestId,
      fileUrl: media.fileUrl,
      thumbnailUrl: media.thumbnailUrl,
      fileType: media.fileType,
      fileSize: media.fileSize,
      width: media.width,
      height: media.height,
      caption: media.caption,
      challengeId: media.challengeId,
      takenAt: media.takenAt,
      uploadedAt: media.uploadedAt,
      processingStatus: media.processingStatus,
      driveSynced: media.driveSynced,
      driveFileId: media.driveFileId,
      guest: {
        id: guests.id,
        name: guests.name,
        avatarUrl: guests.avatarUrl,
      },
    })
    .from(media)
    .leftJoin(guests, eq(media.guestId, guests.id))
    .where(and(...conditions))
    .orderBy(desc(media.uploadedAt))
    .limit(limit + 1); // +1 to check if there are more

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? page[page.length - 1].uploadedAt.toISOString() : null;

  // Only cluster in full feed mode (not filtered by guest)
  const feed = guestId
    ? page.map((item) => ({ type: 'single' as const, item }))
    : clusterMedia(page as any);

  return { feed, nextCursor };
}

export async function getMediaById(mediaId: string) {
  return db
    .select({
      id: media.id,
      guestId: media.guestId,
      fileUrl: media.fileUrl,
      thumbnailUrl: media.thumbnailUrl,
      fileType: media.fileType,
      fileSize: media.fileSize,
      width: media.width,
      height: media.height,
      caption: media.caption,
      challengeId: media.challengeId,
      takenAt: media.takenAt,
      uploadedAt: media.uploadedAt,
      processingStatus: media.processingStatus,
      guest: {
        id: guests.id,
        name: guests.name,
        avatarUrl: guests.avatarUrl,
      },
    })
    .from(media)
    .leftJoin(guests, eq(media.guestId, guests.id))
    .where(eq(media.id, mediaId))
    .then((rows) => rows[0] ?? null);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/clustering.test.ts
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Create feed API route**

`src/app/api/media/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFeedMedia } from '@/lib/db/queries/media';

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
  const guestId = request.nextUrl.searchParams.get('guest') ?? undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10);

  const result = await getFeedMedia({ cursor, limit, guestId });

  return NextResponse.json(result);
}
```

- [ ] **Step 6: Create media detail + delete routes**

`src/app/api/media/[mediaId]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getMediaById } from '@/lib/db/queries/media';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { getAdminSession } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const item = await getMediaById(mediaId);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { mediaId } = await params;
  const item = await getMediaById(mediaId);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete from MinIO
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: item.fileUrl }));
    if (item.thumbnailUrl) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: item.thumbnailUrl }));
    }
  } catch {}

  // Delete from database
  await db.delete(media).where(eq(media.id, mediaId));

  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/media/ src/lib/db/queries/media.ts tests/ vitest.config.ts
git commit -m "feat: add feed API with clustering algorithm, media detail, and delete"
```

---

## Phase 5 — Social Features

### Task 10: Reactions API

**Files:**
- Create: `src/app/api/media/[mediaId]/reactions/route.ts`, `src/lib/db/queries/reactions.ts`

- [ ] **Step 1: Create reactions queries**

`src/lib/db/queries/reactions.ts`:
```typescript
import { db } from '@/lib/db';
import { reactions } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function toggleReaction(mediaId: string, guestId: string, type = 'heart') {
  const existing = await db.query.reactions.findFirst({
    where: and(
      eq(reactions.mediaId, mediaId),
      eq(reactions.guestId, guestId),
      eq(reactions.type, type),
    ),
  });

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    return { action: 'removed' as const };
  }

  await db.insert(reactions).values({ mediaId, guestId, type });
  return { action: 'added' as const };
}

export async function getReactionCount(mediaId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(reactions)
    .where(eq(reactions.mediaId, mediaId));
  return result[0]?.count ?? 0;
}

export async function hasUserReacted(mediaId: string, guestId: string, type = 'heart') {
  const existing = await db.query.reactions.findFirst({
    where: and(
      eq(reactions.mediaId, mediaId),
      eq(reactions.guestId, guestId),
      eq(reactions.type, type),
    ),
  });
  return !!existing;
}
```

- [ ] **Step 2: Create reactions API route**

`src/app/api/media/[mediaId]/reactions/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getGuestId } from '@/lib/auth';
import { toggleReaction, getReactionCount } from '@/lib/db/queries/reactions';
import { broadcast } from '@/lib/sse';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mediaId } = await params;
  const body = await request.json().catch(() => ({}));
  const type = body.type || 'heart';

  const result = await toggleReaction(mediaId, guestId, type);
  const count = await getReactionCount(mediaId);

  broadcast('new_reaction', { mediaId, count });

  // Award points if reaction was added
  if (result.action === 'added') {
    try {
      const { awardReactionPoints } = await import('@/lib/points');
      await awardReactionPoints(mediaId);
    } catch {}
  }

  return NextResponse.json({ ...result, count });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/media/*/reactions/ src/lib/db/queries/reactions.ts
git commit -m "feat: add reactions toggle API with SSE broadcast"
```

---

### Task 11: Comments API

**Files:**
- Create: `src/app/api/media/[mediaId]/comments/route.ts`, `src/lib/db/queries/comments.ts`

- [ ] **Step 1: Create comments queries**

`src/lib/db/queries/comments.ts`:
```typescript
import { db } from '@/lib/db';
import { comments, guests } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';

export async function createComment(data: {
  mediaId: string;
  guestId: string;
  content: string;
  parentId?: string;
}) {
  const [comment] = await db.insert(comments).values(data).returning();
  return comment;
}

export async function getComments(mediaId: string) {
  return db
    .select({
      id: comments.id,
      mediaId: comments.mediaId,
      parentId: comments.parentId,
      content: comments.content,
      createdAt: comments.createdAt,
      guest: {
        id: guests.id,
        name: guests.name,
        avatarUrl: guests.avatarUrl,
      },
    })
    .from(comments)
    .leftJoin(guests, eq(comments.guestId, guests.id))
    .where(eq(comments.mediaId, mediaId))
    .orderBy(asc(comments.createdAt));
}

export async function getCommentCount(mediaId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.mediaId, mediaId));
  return result[0]?.count ?? 0;
}
```

- [ ] **Step 2: Create comments API route**

`src/app/api/media/[mediaId]/comments/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getGuestId } from '@/lib/auth';
import { createComment, getComments, getCommentCount } from '@/lib/db/queries/comments';
import { broadcast } from '@/lib/sse';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const list = await getComments(mediaId);
  return NextResponse.json(list);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mediaId } = await params;
  const body = await request.json();

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 });
  }

  const comment = await createComment({
    mediaId,
    guestId,
    content: body.content.trim(),
    parentId: body.parentId || undefined,
  });

  const count = await getCommentCount(mediaId);
  broadcast('new_comment', { mediaId, count });

  // Award points
  try {
    const { awardCommentPoints } = await import('@/lib/points');
    await awardCommentPoints(guestId);
  } catch {}

  return NextResponse.json(comment, { status: 201 });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/media/*/comments/ src/lib/db/queries/comments.ts
git commit -m "feat: add comments API with threaded replies and SSE broadcast"
```

---

## Phase 6 — Gamification

### Task 12: Points & badges system

**Files:**
- Create: `src/lib/points.ts`, `tests/lib/points.test.ts`

- [ ] **Step 1: Write points test**

`tests/lib/points.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { checkBadges } from '@/lib/points';

describe('checkBadges', () => {
  it('awards "Paparazzi" for 20+ photos', () => {
    const badges = checkBadges({
      currentBadges: [],
      photoCount: 20,
      videoCount: 0,
      commentCount: 0,
      reactionCount: 0,
      challengeCount: 0,
      isFirstUpload: false,
      isAfterMidnight: false,
    });
    expect(badges).toContain('Paparazzi');
  });

  it('awards "Noctambule" for uploads after midnight', () => {
    const badges = checkBadges({
      currentBadges: [],
      photoCount: 1,
      videoCount: 0,
      commentCount: 0,
      reactionCount: 0,
      challengeCount: 0,
      isFirstUpload: false,
      isAfterMidnight: true,
    });
    expect(badges).toContain('Noctambule');
  });

  it('does not re-award existing badges', () => {
    const badges = checkBadges({
      currentBadges: ['Paparazzi'],
      photoCount: 25,
      videoCount: 0,
      commentCount: 0,
      reactionCount: 0,
      challengeCount: 0,
      isFirstUpload: false,
      isAfterMidnight: false,
    });
    expect(badges).not.toContain('Paparazzi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/points.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement points system**

`src/lib/points.ts`:
```typescript
import { db } from '@/lib/db';
import { guests, media, reactions, comments } from '@/lib/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { broadcast } from '@/lib/sse';

type BadgeCheckInput = {
  currentBadges: string[];
  photoCount: number;
  videoCount: number;
  commentCount: number;
  reactionCount: number;
  challengeCount: number;
  isFirstUpload: boolean;
  isAfterMidnight: boolean;
};

const BADGE_RULES: { name: string; check: (input: BadgeCheckInput) => boolean }[] = [
  { name: 'Premier regard', check: (i) => i.isFirstUpload },
  { name: 'Paparazzi', check: (i) => i.photoCount >= 20 },
  { name: 'Vidéaste', check: (i) => i.videoCount >= 1 },
  { name: 'Social butterfly', check: (i) => i.commentCount >= 10 },
  { name: 'Chasseur de défis', check: (i) => i.challengeCount >= 5 },
  { name: 'Noctambule', check: (i) => i.isAfterMidnight },
  { name: 'Fan #1', check: (i) => i.reactionCount >= 50 },
];

export function checkBadges(input: BadgeCheckInput): string[] {
  return BADGE_RULES
    .filter((rule) => !input.currentBadges.includes(rule.name) && rule.check(input))
    .map((rule) => rule.name);
}

export async function awardUploadPoints(mediaId: string) {
  const record = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
  if (!record) return;

  const guest = await db.query.guests.findFirst({ where: eq(guests.id, record.guestId) });
  if (!guest) return;

  let pts = record.fileType.startsWith('video/') ? 15 : 10;

  // Challenge bonus
  if (record.challengeId) {
    const { challenges } = await import('@/lib/db/schema');
    const challenge = await db.query.challenges.findFirst({
      where: eq(challenges.id, record.challengeId),
    });
    if (challenge) pts += challenge.points;
  }

  // First upload bonus: check if this is the very first media in the system
  const totalMedia = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.processingStatus, 'done'));
  const isFirstUpload = (totalMedia[0]?.count ?? 0) <= 1;
  if (isFirstUpload) pts += 20;

  await db.update(guests).set({ points: sql`points + ${pts}` }).where(eq(guests.id, guest.id));

  // Check badges
  const photoCount = await db.select({ count: sql<number>`count(*)` }).from(media).where(and(eq(media.guestId, guest.id), sql`file_type LIKE 'image/%'`));
  const videoCount = await db.select({ count: sql<number>`count(*)` }).from(media).where(and(eq(media.guestId, guest.id), sql`file_type LIKE 'video/%'`));
  const commentCount = await db.select({ count: sql<number>`count(*)` }).from(comments).where(and(eq(comments.guestId, guest.id), ne(comments.mediaId, sql`(SELECT id FROM media WHERE guest_id = ${guest.id} LIMIT 1)`)));
  const reactionCount = await db.select({ count: sql<number>`count(*)` }).from(reactions).where(eq(reactions.guestId, guest.id));
  const challengeCount = await db.select({ count: sql<number>`count(DISTINCT challenge_id)` }).from(media).where(and(eq(media.guestId, guest.id), sql`challenge_id IS NOT NULL`));

  const isAfterMidnight = record.takenAt ? record.takenAt.getHours() < 6 : false;

  const newBadges = checkBadges({
    currentBadges: guest.badges,
    photoCount: photoCount[0]?.count ?? 0,
    videoCount: videoCount[0]?.count ?? 0,
    commentCount: commentCount[0]?.count ?? 0,
    reactionCount: reactionCount[0]?.count ?? 0,
    challengeCount: challengeCount[0]?.count ?? 0,
    isFirstUpload,
    isAfterMidnight,
  });

  if (newBadges.length > 0) {
    await db.update(guests).set({
      badges: sql`badges || ${sql.raw(`ARRAY[${newBadges.map((b) => `'${b}'`).join(',')}]::text[]`)}`,
    }).where(eq(guests.id, guest.id));

    for (const badge of newBadges) {
      broadcast('badge_unlocked', { guestId: guest.id, badge });
    }
  }

  broadcast('leaderboard_update', {});
}

export async function awardReactionPoints(mediaId: string) {
  const record = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
  if (!record) return;

  // +2 points to the photo owner
  await db.update(guests).set({ points: sql`points + 2` }).where(eq(guests.id, record.guestId));
  broadcast('leaderboard_update', {});
}

export async function awardCommentPoints(guestId: string) {
  await db.update(guests).set({ points: sql`points + 5` }).where(eq(guests.id, guestId));
  broadcast('leaderboard_update', {});
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/points.test.ts
```
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/points.ts tests/lib/points.test.ts
git commit -m "feat: add points calculation and badge system"
```

---

### Task 13: Challenges API + Leaderboard API

**Files:**
- Create: `src/app/api/challenges/route.ts`, `src/lib/db/queries/challenges.ts`, `src/app/api/leaderboard/route.ts`, `src/app/api/moments/route.ts`, `src/lib/db/queries/moments.ts`

- [ ] **Step 1: Create challenges queries and route**

`src/lib/db/queries/challenges.ts`:
```typescript
import { db } from '@/lib/db';
import { challenges, media } from '@/lib/db/schema';
import { eq, asc, sql, and } from 'drizzle-orm';

export async function getAllChallenges() {
  return db.query.challenges.findMany({ orderBy: [asc(challenges.sortOrder)] });
}

export async function getChallengeParticipations(challengeId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(media)
    .where(eq(media.challengeId, challengeId));
  return result[0]?.count ?? 0;
}

export async function getCompletedChallengeIds(guestId: string) {
  const result = await db
    .select({ challengeId: media.challengeId })
    .from(media)
    .where(and(eq(media.guestId, guestId), sql`challenge_id IS NOT NULL`))
    .groupBy(media.challengeId);
  return result.map((r) => r.challengeId).filter(Boolean) as string[];
}
```

`src/app/api/challenges/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getAllChallenges, getChallengeParticipations } from '@/lib/db/queries/challenges';
import { getGuestId, getAdminSession } from '@/lib/auth';
import { getCompletedChallengeIds } from '@/lib/db/queries/challenges';
import { db } from '@/lib/db';
import { challenges } from '@/lib/db/schema';

export async function GET() {
  const guestId = await getGuestId();
  const all = await getAllChallenges();
  const completed = guestId ? await getCompletedChallengeIds(guestId) : [];

  const withMeta = await Promise.all(
    all.map(async (c) => ({
      ...c,
      participations: await getChallengeParticipations(c.id),
      completed: completed.includes(c.id),
    }))
  );

  return NextResponse.json(withMeta);
}

export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const [challenge] = await db.insert(challenges).values({
    title: body.title,
    description: body.description,
    points: body.points || 30,
    unlockAt: body.unlockAt ? new Date(body.unlockAt) : null,
    sortOrder: body.sortOrder || 0,
    isActive: body.unlockAt ? false : true,
  }).returning();

  return NextResponse.json(challenge, { status: 201 });
}
```

- [ ] **Step 2: Create leaderboard route**

`src/app/api/leaderboard/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guests, media, reactions } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export async function GET() {
  // Top guests by points
  const topGuests = await db.query.guests.findMany({
    orderBy: [desc(guests.points)],
    limit: 20,
  });

  // Most liked photo
  const mostLiked = await db
    .select({
      mediaId: reactions.mediaId,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(reactions)
    .groupBy(reactions.mediaId)
    .orderBy(sql`count(*) DESC`)
    .limit(1);

  let mostLikedMedia = null;
  if (mostLiked.length > 0) {
    mostLikedMedia = await db
      .select({
        id: media.id,
        thumbnailUrl: media.thumbnailUrl,
        guestName: guests.name,
        reactionCount: sql<number>`(SELECT count(*) FROM reactions WHERE media_id = ${media.id})`,
      })
      .from(media)
      .leftJoin(guests, eq(media.guestId, guests.id))
      .where(eq(media.id, mostLiked[0].mediaId))
      .then((rows) => rows[0] ?? null);
  }

  // Global stats
  const totalPhotos = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.processingStatus, 'done'));
  const activeGuests = await db.select({ count: sql<number>`count(*)` }).from(guests);
  const challengesCompleted = await db.select({ count: sql<number>`count(DISTINCT challenge_id)` }).from(media).where(sql`challenge_id IS NOT NULL`);

  return NextResponse.json({
    topGuests,
    mostLikedMedia,
    stats: {
      totalPhotos: totalPhotos[0]?.count ?? 0,
      activeGuests: activeGuests[0]?.count ?? 0,
      challengesCompleted: challengesCompleted[0]?.count ?? 0,
    },
  });
}
```

- [ ] **Step 3: Create moments queries and route**

`src/lib/db/queries/moments.ts`:
```typescript
import { db } from '@/lib/db';
import { moments, media, guests } from '@/lib/db/schema';
import { asc, eq, and, gte, lte, sql } from 'drizzle-orm';

export async function getAllMoments() {
  return db.query.moments.findMany({ orderBy: [asc(moments.startTime)] });
}

export async function getMomentsWithMedia() {
  const allMoments = await getAllMoments();

  return Promise.all(
    allMoments.map(async (moment) => {
      const photos = await db
        .select({
          id: media.id,
          thumbnailUrl: media.thumbnailUrl,
          guestId: media.guestId,
          guestName: guests.name,
        })
        .from(media)
        .leftJoin(guests, eq(media.guestId, guests.id))
        .where(
          and(
            eq(media.processingStatus, 'done'),
            gte(media.takenAt, moment.startTime),
            lte(media.takenAt, moment.endTime),
          )
        )
        .limit(6);

      const photoCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(media)
        .where(
          and(
            eq(media.processingStatus, 'done'),
            gte(media.takenAt, moment.startTime),
            lte(media.takenAt, moment.endTime),
          )
        );

      const uniqueGuests = await db
        .select({ count: sql<number>`count(DISTINCT guest_id)` })
        .from(media)
        .where(
          and(
            eq(media.processingStatus, 'done'),
            gte(media.takenAt, moment.startTime),
            lte(media.takenAt, moment.endTime),
          )
        );

      return {
        ...moment,
        previews: photos,
        photoCount: photoCount[0]?.count ?? 0,
        guestCount: uniqueGuests[0]?.count ?? 0,
      };
    })
  );
}
```

`src/app/api/moments/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getMomentsWithMedia } from '@/lib/db/queries/moments';

export async function GET() {
  const moments = await getMomentsWithMedia();
  return NextResponse.json(moments);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/challenges/ src/app/api/leaderboard/ src/app/api/moments/ src/lib/db/queries/challenges.ts src/lib/db/queries/moments.ts
git commit -m "feat: add challenges, leaderboard, and moments API routes"
```

---

## Phase 7 — Cron Jobs (Drive Sync + Challenge Unlock)

### Task 14: Cron setup + challenge unlock

**Files:**
- Create: `src/lib/cron.ts`, `instrumentation.ts`

- [ ] **Step 1: Create cron module**

`src/lib/cron.ts`:
```typescript
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
```

- [ ] **Step 2: Create instrumentation.ts**

`instrumentation.ts` (project root):
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCronJobs } = await import('./src/lib/cron');
    startCronJobs();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/cron.ts instrumentation.ts
git commit -m "feat: add cron jobs for challenge unlock and Drive sync scheduling"
```

---

### Task 15: Google Drive sync

**Files:**
- Create: `src/lib/drive.ts`, `src/app/api/sync-drive/route.ts`

- [ ] **Step 1: Create Drive sync module**

`src/lib/drive.ts`:
```typescript
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { media, guests, moments, config } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET } from '@/lib/minio';
import { Readable } from 'stream';

function getDriveClient() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(key),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string,
): Promise<string> {
  // Check if exists
  const existing = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (existing.data.files?.length) {
    return existing.data.files[0].id!;
  }

  // Create
  const folder = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return folder.data.id!;
}

function findClosestMoment(
  takenAt: Date,
  allMoments: { id: string; label: string | null; startTime: Date; endTime: Date }[],
): { id: string; label: string } | null {
  // Check if falls within a moment
  for (const m of allMoments) {
    if (takenAt >= m.startTime && takenAt <= m.endTime) {
      return { id: m.id, label: m.label || 'Moment' };
    }
  }

  // Find closest moment
  let closest = null;
  let minDiff = Infinity;

  for (const m of allMoments) {
    const diffStart = Math.abs(takenAt.getTime() - m.startTime.getTime());
    const diffEnd = Math.abs(takenAt.getTime() - m.endTime.getTime());
    const diff = Math.min(diffStart, diffEnd);

    if (diff < minDiff) {
      minDiff = diff;
      closest = m;
    }
  }

  // If closest is more than 2 hours away, it's "Autres"
  if (!closest || minDiff > 2 * 60 * 60 * 1000) {
    return null;
  }

  return { id: closest.id, label: closest.label || 'Moment' };
}

export async function syncToDrive() {
  const drive = getDriveClient();
  if (!drive) {
    console.log('[drive] No service account key configured, skipping sync.');
    return { synced: 0 };
  }

  // Get root folder ID
  const driveConfig = await db.query.config.findFirst({ where: eq(config.key, 'drive') });
  const rootFolderId = (driveConfig?.value as any)?.folder_id;
  if (!rootFolderId) {
    console.log('[drive] No root folder configured, skipping sync.');
    return { synced: 0 };
  }

  const allMomentsFolder = (driveConfig?.value as any)?.all_moments_folder_id;

  // Get unsynced media
  const unsynced = await db
    .select()
    .from(media)
    .leftJoin(guests, eq(media.guestId, guests.id))
    .where(and(eq(media.driveSynced, false), eq(media.processingStatus, 'done')))
    .limit(20);

  const allMoments = await db.query.moments.findMany();

  let synced = 0;

  for (const row of unsynced) {
    try {
      const m = row.media;
      const guest = row.guests;
      const guestName = guest?.name || 'Inconnu';
      const relation = guest?.relation || '';

      // Get or create guest folder
      let guestFolderId = guest?.driveFolderId;
      if (!guestFolderId) {
        const folderName = relation ? `${guestName} (${relation})` : guestName;
        guestFolderId = await getOrCreateFolder(drive, folderName, rootFolderId);
        if (guest) {
          await db.update(guests).set({ driveFolderId: guestFolderId }).where(eq(guests.id, guest.id));
        }
      }

      // Find moment for this media
      const moment = m.takenAt ? findClosestMoment(m.takenAt, allMoments) : null;
      const momentLabel = moment?.label || 'Autres';

      // Get or create moment subfolder in guest folder
      const momentFolderId = await getOrCreateFolder(drive, momentLabel, guestFolderId);

      // Download from MinIO (stream)
      const obj = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: m.fileUrl }));
      const stream = obj.Body as Readable;

      // Build filename
      const time = m.takenAt || m.uploadedAt;
      const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      const ext = m.fileUrl.split('.').pop() || 'jpg';
      const fileName = `${guestName}_${timeStr}_${m.id.slice(0, 8)}.${ext}`;

      // Upload to Drive
      const driveFile = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [momentFolderId],
        },
        media: {
          mimeType: m.fileType,
          body: stream,
        },
        fields: 'id',
      });

      // Create shortcut in _Tous les moments
      if (allMomentsFolder && moment) {
        const allMomentSubfolder = await getOrCreateFolder(
          drive,
          `${momentLabel} (${allMoments.find((am) => am.id === moment.id)?.startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') || ''})`,
          allMomentsFolder,
        );
        await drive.files.create({
          requestBody: {
            name: fileName,
            mimeType: 'application/vnd.google-apps.shortcut',
            shortcutDetails: { targetId: driveFile.data.id! },
            parents: [allMomentSubfolder],
          },
        });
      }

      // Mark as synced
      await db.update(media).set({
        driveSynced: true,
        driveFileId: driveFile.data.id!,
      }).where(eq(media.id, m.id));

      synced++;
    } catch (err) {
      console.error(`[drive] Sync failed for media ${row.media.id}:`, err);
    }
  }

  console.log(`[drive] Synced ${synced} files.`);
  return { synced };
}
```

- [ ] **Step 2: Create manual sync endpoint**

`src/app/api/sync-drive/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { syncToDrive } from '@/lib/drive';

export async function POST() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await syncToDrive();
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/drive.ts src/app/api/sync-drive/
git commit -m "feat: add Google Drive sync with guest/moment folder structure and shortcuts"
```

---

## Phase 8 — UI Pages

### Task 16: Bottom nav + shared layout

**Files:**
- Create: `src/components/bottom-nav.tsx`, `src/app/(main)/layout.tsx`

- [ ] **Step 1: Create BottomNav component**

`src/components/bottom-nav.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/feed', label: 'Feed', icon: 'grid' },
  { href: '/challenges', label: 'Défis', icon: 'star' },
  { href: '/upload', label: '', icon: 'camera', isCenter: true },
  { href: '/moments', label: 'Moments', icon: 'clock' },
  { href: '/leaderboard', label: 'Score', icon: 'chart' },
];

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const stroke = active ? '#5B6B52' : '#A39E98';
  const iconMap: Record<string, JSX.Element> = {
    grid: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
    star: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    camera: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    clock: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    chart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  };

  return iconMap[icon] || null;
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);

          if (item.isCenter) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center">
                <div className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-primary">
                  <NavIcon icon={item.icon} active={false} />
                </div>
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5">
              <NavIcon icon={item.icon} active={active} />
              <span className={`text-[10px] ${active ? 'font-medium text-primary' : 'text-text-tertiary'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create shared layout**

`src/app/(main)/layout.tsx`:
```tsx
import BottomNav from '@/components/bottom-nav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bottom-nav.tsx src/app/\(main\)/layout.tsx
git commit -m "feat: add bottom navigation bar and shared main layout"
```

---

### Task 17: Feed page UI

**Files:**
- Create: `src/app/(main)/feed/page.tsx`, `src/components/media-card.tsx`, `src/components/cluster-card.tsx`, `src/components/avatar-row.tsx`, `src/components/download-button.tsx`, `src/components/reaction-button.tsx`, `src/hooks/use-infinite-feed.ts`, `src/hooks/use-guest.ts`

This is the largest UI task. Each component is a separate file to keep them focused.

- [ ] **Step 1: Create use-guest hook**

`src/hooks/use-guest.ts`:
```tsx
'use client';

import { useState, useEffect } from 'react';

export function useGuest() {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);

  useEffect(() => {
    setGuestId(localStorage.getItem('guest_id'));
    setGuestName(localStorage.getItem('guest_name'));
  }, []);

  return { guestId, guestName };
}
```

- [ ] **Step 2: Create infinite feed hook**

`src/hooks/use-infinite-feed.ts`:
```tsx
'use client';

import { useState, useCallback, useRef } from 'react';

export function useInfiniteFeed(guestFilter?: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const params = new URLSearchParams();
    if (cursorRef.current) params.set('cursor', cursorRef.current);
    if (guestFilter) params.set('guest', guestFilter);

    const res = await fetch(`/api/media?${params}`);
    const data = await res.json();

    setItems((prev) => [...prev, ...data.feed]);
    cursorRef.current = data.nextCursor;
    setHasMore(!!data.nextCursor);
    setLoading(false);
  }, [loading, hasMore, guestFilter]);

  const prepend = useCallback((item: any) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  return { items, loading, hasMore, loadMore, prepend };
}
```

- [ ] **Step 3: Create DownloadButton and ReactionButton components**

`src/components/download-button.tsx`:
```tsx
'use client';

export default function DownloadButton({ fileUrl }: { fileUrl: string }) {
  return (
    <a
      href={`/api/media/file/${fileUrl}?download=true`}
      className="flex items-center gap-1"
      download
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </a>
  );
}
```

`src/components/reaction-button.tsx`:
```tsx
'use client';

import { useState } from 'react';

export default function ReactionButton({
  mediaId,
  initialCount,
  initialReacted,
}: {
  mediaId: string;
  initialCount: number;
  initialReacted: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [reacted, setReacted] = useState(initialReacted);

  async function toggle() {
    setReacted(!reacted);
    setCount((c) => (reacted ? c - 1 : c + 1));

    await fetch(`/api/media/${mediaId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'heart' }),
    });
  }

  return (
    <button onClick={toggle} className="flex items-center gap-1">
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill={reacted ? '#E24B4A' : 'none'}
        stroke={reacted ? '#E24B4A' : 'currentColor'}
        strokeWidth="1.5"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span className="text-xs text-text-secondary">{count}</span>
    </button>
  );
}
```

- [ ] **Step 4: Create MediaCard component**

`src/components/media-card.tsx`:
```tsx
import Link from 'next/link';
import ReactionButton from './reaction-button';
import DownloadButton from './download-button';

type Props = {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileType: string;
  caption: string | null;
  challengeId: string | null;
  guest: { id: string; name: string; avatarUrl: string | null } | null;
  takenAt: string | null;
};

export default function MediaCard({ id, fileUrl, thumbnailUrl, fileType, caption, challengeId, guest, takenAt }: Props) {
  const displayUrl = thumbnailUrl || fileUrl;
  const time = takenAt ? new Date(takenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  const isVideo = fileType.startsWith('video/');

  return (
    <div className="bg-bg-card rounded-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Link href={`/feed?guest=${guest?.id}`}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-secondary text-xs font-medium">
            {guest?.name?.charAt(0) || '?'}
          </div>
        </Link>
        <span className="text-[13px] font-medium">{guest?.name}</span>
        <span className="text-[11px] text-text-tertiary">{time}</span>
      </div>

      {/* Media */}
      <Link href={`/media/${id}`}>
        {isVideo ? (
          <div className="relative aspect-video bg-bg-secondary">
            <img src={`/api/media/file/${displayUrl}`} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/40 p-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </div>
            </div>
          </div>
        ) : (
          <img src={`/api/media/file/${displayUrl}`} alt="" className="w-full" loading="lazy" />
        )}
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-3 px-4 py-2">
        <ReactionButton mediaId={id} initialCount={0} initialReacted={false} />
        <Link href={`/media/${id}`} className="flex items-center gap-1 text-text-tertiary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Link>
        <div className="ml-auto text-text-tertiary">
          <DownloadButton fileUrl={fileUrl} />
        </div>
        {challengeId && (
          <div className="flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-[11px] font-medium text-secondary">Défi</span>
          </div>
        )}
      </div>

      {/* Caption */}
      {caption && (
        <p className="px-4 pb-3 text-[13px] leading-relaxed text-text-secondary">
          <span className="font-medium text-text">{guest?.name}</span>{' '}{caption}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create ClusterCard component**

`src/components/cluster-card.tsx`:
```tsx
import Link from 'next/link';

type ClusterItem = {
  id: string;
  thumbnailUrl: string | null;
  fileUrl: string;
  guest: { id: string; name: string } | null;
};

export default function ClusterCard({ items, time }: { items: ClusterItem[]; time: string }) {
  const displayTime = new Date(time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const main = items[0];
  const rest = items.slice(1, 3);

  return (
    <div className="rounded-card overflow-hidden bg-bg-secondary p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/20">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <span className="text-xs font-medium tracking-wide text-secondary">
          MÊME MOMENT &middot; {displayTime}
        </span>
      </div>

      {/* Grid */}
      <div className="flex gap-1.5">
        <Link href={`/media/${main.id}`} className="flex-[2]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <img
              src={`/api/media/file/${main.thumbnailUrl || main.fileUrl}`}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5">
              <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-bg-secondary text-[8px] font-medium">
                {main.guest?.name?.charAt(0)}
              </div>
              <span className="text-[10px] text-white">{main.guest?.name}</span>
            </div>
          </div>
        </Link>
        <div className="flex flex-1 flex-col gap-1.5">
          {rest.map((item) => (
            <Link key={item.id} href={`/media/${item.id}`} className="flex-1">
              <div className="relative h-full overflow-hidden rounded-lg">
                <img
                  src={`/api/media/file/${item.thumbnailUrl || item.fileUrl}`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-bg-secondary text-[8px] font-medium">
                  {item.guest?.name?.charAt(0)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-1.5 text-center text-[11px] text-text-tertiary">
        {items.length} regards sur ce moment
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Create AvatarRow component**

`src/components/avatar-row.tsx`:
```tsx
'use client';

type Guest = { id: string; name: string; avatarUrl: string | null };

export default function AvatarRow({
  guests,
  activeGuestId,
  onSelect,
}: {
  guests: Guest[];
  activeGuestId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto border-b border-border px-4 py-3">
      {/* "TOUS" chip */}
      <button
        onClick={() => onSelect(null)}
        className="flex flex-shrink-0 flex-col items-center gap-1"
      >
        <div
          className={`flex h-[50px] w-[50px] items-center justify-center rounded-full border-2 ${
            !activeGuestId ? 'border-primary bg-bg-secondary' : 'border-transparent bg-bg-secondary'
          }`}
        >
          <span className="text-xs font-medium text-primary">TOUS</span>
        </div>
        <span className="text-[10px] text-text-tertiary">Tous</span>
      </button>

      {guests.map((g) => (
        <button
          key={g.id}
          onClick={() => onSelect(g.id)}
          className="flex flex-shrink-0 flex-col items-center gap-1"
        >
          <div
            className={`flex h-[50px] w-[50px] items-center justify-center rounded-full border-2 ${
              activeGuestId === g.id ? 'border-secondary' : 'border-transparent'
            } bg-bg-secondary`}
          >
            <span className="text-lg font-medium text-text-secondary">
              {g.name.charAt(0)}
            </span>
          </div>
          <span className="text-[10px] text-text-tertiary">{g.name}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Create Feed page**

`src/app/(main)/feed/page.tsx`:
```tsx
'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useInfiniteFeed } from '@/hooks/use-infinite-feed';
import { useSSE } from '@/hooks/use-sse';
import MediaCard from '@/components/media-card';
import ClusterCard from '@/components/cluster-card';
import AvatarRow from '@/components/avatar-row';

export default function FeedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const guestFilter = searchParams.get('guest') ?? undefined;
  const { items, loading, hasMore, loadMore, prepend } = useInfiniteFeed(guestFilter);
  const [guests, setGuests] = useState<any[]>([]);
  const observerRef = useRef<HTMLDivElement>(null);

  // Load guests for avatar row
  useEffect(() => {
    fetch('/api/guests').then((r) => r.json()).then(setGuests);
  }, []);

  // Initial load
  useEffect(() => {
    loadMore();
  }, [guestFilter]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  // SSE for new media
  useSSE({
    new_media: (data: any) => {
      if (!guestFilter) {
        prepend({ type: 'single', item: data });
      }
    },
  });

  function handleGuestSelect(id: string | null) {
    if (id) {
      router.push(`/feed?guest=${id}`);
    } else {
      router.push('/feed');
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h1 className="font-serif text-[17px] font-medium">Regards</h1>
          <p className="text-[11px] text-primary">
            {guests.length} regards &middot; {items.length} photos
          </p>
        </div>
      </div>

      {/* Avatar row */}
      <AvatarRow
        guests={guests}
        activeGuestId={guestFilter ?? null}
        onSelect={handleGuestSelect}
      />

      {/* Feed */}
      <div className="space-y-3 p-4">
        {items.map((item, i) => {
          if (item.type === 'cluster') {
            return <ClusterCard key={`cluster-${i}`} items={item.items} time={item.time} />;
          }
          const m = item.item;
          return (
            <MediaCard
              key={m.id}
              id={m.id}
              fileUrl={m.fileUrl}
              thumbnailUrl={m.thumbnailUrl}
              fileType={m.fileType}
              caption={m.caption}
              challengeId={m.challengeId}
              guest={m.guest}
              takenAt={m.takenAt}
            />
          );
        })}

        {loading && <p className="text-center text-sm text-text-tertiary">Chargement...</p>}

        <div ref={observerRef} className="h-4" />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify feed page renders**

```bash
npm run dev
```

Navigate to http://localhost:3000, join as a guest, then access /feed. It should render the header, avatar row, and empty feed. No errors in console.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(main\)/feed/ src/components/ src/hooks/
git commit -m "feat: add feed page with clustering, avatar row, infinite scroll, and SSE"
```

---

### Task 18: Upload page

**Files:**
- Create: `src/app/(main)/upload/page.tsx`, `src/components/upload-preview.tsx`

- [ ] **Step 1: Create upload preview component**

`src/components/upload-preview.tsx`:
```tsx
'use client';

import { useState } from 'react';

type FileWithCaption = {
  file: File;
  preview: string;
  caption: string;
};

export default function UploadPreview({
  files,
  onCaptionChange,
  onRemove,
}: {
  files: FileWithCaption[];
  onCaptionChange: (index: number, caption: string) => void;
  onRemove: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (files.length === 0) return null;

  const active = files[activeIndex];

  return (
    <div>
      {/* Main preview */}
      <div className="relative aspect-square overflow-hidden rounded-card bg-bg-secondary">
        {active.file.type.startsWith('video/') ? (
          <video src={active.preview} className="h-full w-full object-cover" />
        ) : (
          <img src={active.preview} alt="" className="h-full w-full object-cover" />
        )}
        <button
          onClick={() => onRemove(activeIndex)}
          className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Caption */}
      <input
        type="text"
        value={active.caption}
        onChange={(e) => onCaptionChange(activeIndex, e.target.value)}
        placeholder="Ajouter un commentaire..."
        className="mt-3 w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
      />

      {/* Thumbnails strip */}
      {files.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                i === activeIndex ? 'border-primary' : 'border-transparent'
              }`}
            >
              <img src={f.preview} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create upload page**

`src/app/(main)/upload/page.tsx`:
```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UploadPreview from '@/components/upload-preview';

type FileWithCaption = { file: File; preview: string; caption: string };

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileWithCaption[]>([]);
  const [challengeId, setChallengeId] = useState('');
  const [challenges, setChallenges] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/challenges')
      .then((r) => r.json())
      .then((data) => setChallenges(data.filter((c: any) => c.isActive && !c.completed)));
  }, []);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const additions = Array.from(newFiles).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: '',
    }));
    setFiles((prev) => [...prev, ...additions]);
  }

  function handleCaptionChange(index: number, caption: string) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, caption } : f)));
  }

  function handleRemove(index: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);

    const guestId = localStorage.getItem('guest_id') || '';
    let uploaded = 0;

    for (const f of files) {
      try {
        // Use tus upload
        const { Upload } = await import('tus-js-client');

        await new Promise<void>((resolve, reject) => {
          const upload = new Upload(f.file, {
            endpoint: '/api/upload/tus/',
            retryDelays: [0, 1000, 3000, 5000],
            metadata: {
              filename: f.file.name,
              filetype: f.file.type,
              guest_id: guestId,
              caption: f.caption || '',
              challenge_id: challengeId || '',
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              const fileProgress = (bytesUploaded / bytesTotal) * 100;
              const totalProgress = ((uploaded * 100 + fileProgress) / files.length);
              setProgress(Math.round(totalProgress));
            },
            onSuccess: () => {
              uploaded++;
              resolve();
            },
            onError: (error) => {
              console.error('Upload error:', error);
              reject(error);
            },
          });

          upload.start();
        });
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    setUploading(false);
    router.push('/feed');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Partager</h1>
      </div>

      <div className="flex-1 space-y-4 p-5">
        {files.length === 0 ? (
          <div className="space-y-3">
            {/* Camera */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-card bg-primary/10 p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium">Prendre une photo</p>
                <p className="text-xs text-text-secondary">Ouvrir la caméra</p>
              </div>
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            {/* Gallery */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-card border border-border p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium">Choisir depuis la galerie</p>
                <p className="text-xs text-text-secondary">Photos et vidéos</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>
        ) : (
          <>
            <UploadPreview
              files={files}
              onCaptionChange={handleCaptionChange}
              onRemove={handleRemove}
            />

            {/* Challenge selector */}
            {challenges.length > 0 && (
              <div>
                <label className="mb-2 block text-[13px] text-text-secondary">
                  Défi (optionnel)
                </label>
                <select
                  value={challengeId}
                  onChange={(e) => setChallengeId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none"
                >
                  <option value="">Aucun défi</option>
                  {challenges.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.title} (+{c.points} pts)</option>
                  ))}
                </select>
              </div>
            )}

            {/* Add more */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-primary"
            >
              + Ajouter d'autres fichiers
            </button>
          </>
        )}
      </div>

      {/* Submit */}
      {files.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          {uploading && (
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full rounded-lg bg-primary py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {uploading ? `Envoi en cours... ${progress}%` : `Envoyer ${files.length} fichier${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
```

Note: Install `tus-js-client` for the client-side upload:
```bash
npm install tus-js-client
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/upload/ src/components/upload-preview.tsx package.json
git commit -m "feat: add upload page with tus resumable upload, preview grid, and captions"
```

---

### Task 19: Remaining UI pages (Challenges, Moments, Leaderboard, Media Detail)

**Files:**
- Create: `src/app/(main)/challenges/page.tsx`, `src/app/(main)/moments/page.tsx`, `src/app/(main)/leaderboard/page.tsx`, `src/app/media/[mediaId]/page.tsx`, `src/components/challenge-card.tsx`, `src/components/moment-node.tsx`, `src/components/comment-thread.tsx`, `src/components/toast.tsx`

- [ ] **Step 1: Create ChallengeCard component**

`src/components/challenge-card.tsx`:
```tsx
type Props = {
  title: string;
  description: string;
  points: number;
  isActive: boolean;
  unlockAt: string | null;
  completed: boolean;
  participations: number;
};

export default function ChallengeCard({ title, description, points, isActive, unlockAt, completed, participations }: Props) {
  const unlockTime = unlockAt
    ? new Date(unlockAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className={`rounded-card border-l-[3px] p-3.5 ${
        completed
          ? 'border-l-primary bg-bg-secondary'
          : isActive
            ? 'border-l-secondary bg-bg-secondary'
            : 'border-l-text-tertiary bg-bg-secondary opacity-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              +{points} pts
            </span>
            <span className="text-[11px] text-text-tertiary">{participations} participations</span>
          </div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
          {!isActive && unlockTime && (
            <p className="mt-1 text-xs text-text-tertiary">
              Déverrouillage à {unlockTime}
            </p>
          )}
        </div>
        {completed && (
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        {!isActive && !completed && (
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-text-tertiary/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A39E98" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Challenges page**

`src/app/(main)/challenges/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import ChallengeCard from '@/components/challenge-card';

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/challenges').then((r) => r.json()).then(setChallenges);
  }, []);

  const completed = challenges.filter((c) => c.completed).length;

  return (
    <div>
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Défis photo</h1>
        <p className="text-[11px] text-text-tertiary">{completed}/{challenges.length} complétés</p>
      </div>

      <div className="p-4">
        {/* Progress bar */}
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${challenges.length ? (completed / challenges.length) * 100 : 0}%` }}
          />
        </div>

        <div className="space-y-2.5">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} {...c} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create MomentNode and Moments page**

`src/components/moment-node.tsx`:
```tsx
type Props = {
  label: string;
  startTime: string;
  endTime: string;
  photoCount: number;
  guestCount: number;
  previews: { id: string; thumbnailUrl: string | null }[];
  isLast?: boolean;
};

export default function MomentNode({ label, startTime, endTime, photoCount, guestCount, previews, isLast }: Props) {
  const start = new Date(startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const end = new Date(endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-primary bg-white" />
        {!isLast && <div className="w-0.5 flex-1 bg-primary/20" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <p className="text-xs text-text-tertiary">{start} — {end}</p>
        <p className="mt-0.5 font-medium">{label}</p>
        <p className="text-xs text-text-secondary">
          {photoCount} photos &middot; {guestCount} regards
        </p>

        {previews.length > 0 && (
          <div className="mt-2 flex gap-1.5">
            {previews.slice(0, 4).map((p) => (
              <div key={p.id} className="h-14 w-14 overflow-hidden rounded-lg">
                <img
                  src={`/api/media/file/${p.thumbnailUrl || ''}`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

`src/app/(main)/moments/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import MomentNode from '@/components/moment-node';

export default function MomentsPage() {
  const [moments, setMoments] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/moments').then((r) => r.json()).then(setMoments);
  }, []);

  return (
    <div>
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Moments</h1>
        <p className="text-[11px] text-text-tertiary">La journée en un coup d'oeil</p>
      </div>

      <div className="p-5">
        {moments.map((m, i) => (
          <MomentNode
            key={m.id}
            label={m.label}
            startTime={m.startTime}
            endTime={m.endTime}
            photoCount={m.photoCount}
            guestCount={m.guestCount}
            previews={m.previews}
            isLast={i === moments.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Leaderboard page**

`src/app/(main)/leaderboard/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useGuest } from '@/hooks/use-guest';

export default function LeaderboardPage() {
  const { guestId } = useGuest();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/leaderboard').then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="p-5 text-center text-sm text-text-tertiary">Chargement...</div>;

  const currentGuest = data.topGuests.find((g: any) => g.id === guestId);

  return (
    <div>
      <div className="border-b border-border px-5 py-3.5">
        <h1 className="text-base font-medium">Classement</h1>
      </div>

      <div className="p-5 space-y-6">
        {/* Global stats */}
        <div className="flex justify-around rounded-card bg-bg-secondary p-4">
          <div className="text-center">
            <p className="text-lg font-medium">{data.stats.activeGuests}</p>
            <p className="text-[11px] text-text-tertiary">Regards</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">{data.stats.totalPhotos}</p>
            <p className="text-[11px] text-text-tertiary">Photos</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">{data.stats.challengesCompleted}</p>
            <p className="text-[11px] text-text-tertiary">Défis</p>
          </div>
        </div>

        {/* My badges */}
        {currentGuest && currentGuest.badges.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-medium">Vos badges</h2>
            <div className="flex flex-wrap gap-2">
              {currentGuest.badges.map((badge: string) => (
                <span key={badge} className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Most liked photo */}
        {data.mostLikedMedia && (
          <div>
            <h2 className="mb-2 text-sm font-medium">Photo la plus aimée</h2>
            <div className="overflow-hidden rounded-card">
              <img
                src={`/api/media/file/${data.mostLikedMedia.thumbnailUrl}`}
                alt=""
                className="aspect-video w-full object-cover"
              />
              <div className="bg-bg-secondary p-3">
                <p className="text-sm">
                  Par <span className="font-medium">{data.mostLikedMedia.guestName}</span>
                  {' '}&middot; {data.mostLikedMedia.reactionCount} coeurs
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ranking */}
        <div>
          <h2 className="mb-2 text-sm font-medium">Top photographes</h2>
          <div className="space-y-2">
            {data.topGuests.map((g: any, i: number) => (
              <div
                key={g.id}
                className={`flex items-center gap-3 rounded-card p-3 ${
                  g.id === guestId ? 'bg-primary/5 border border-primary/20' : 'bg-bg-secondary'
                }`}
              >
                <span className="w-6 text-center text-sm font-medium text-text-tertiary">
                  {i + 1}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-sm font-medium">
                  {g.name.charAt(0)}
                </div>
                <span className="flex-1 text-sm font-medium">{g.name}</span>
                <span className="text-sm text-primary">{g.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create CommentThread and Media Detail page**

`src/components/comment-thread.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';

export default function CommentThread({ mediaId }: { mediaId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/media/${mediaId}/comments`).then((r) => r.json()).then(setComments);
  }, [mediaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    const res = await fetch(`/api/media/${mediaId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim() }),
    });

    if (res.ok) {
      const comment = await res.json();
      setComments((prev) => [...prev, { ...comment, guest: { name: localStorage.getItem('guest_name') || '?' } }]);
      setNewComment('');
    }
    setSubmitting(false);
  }

  return (
    <div>
      <div className="max-h-60 space-y-3 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className={`${c.parentId ? 'ml-8' : ''}`}>
            <p className="text-[13px]">
              <span className="font-medium">{c.guest?.name}</span>{' '}
              <span className="text-text-secondary">{c.content}</span>
            </p>
            <p className="text-[10px] text-text-tertiary">
              {new Date(c.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Ajouter un commentaire..."
          className="flex-1 rounded-full border border-border bg-white px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || submitting}
          className="rounded-full bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
```

`src/app/media/[mediaId]/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactionButton from '@/components/reaction-button';
import DownloadButton from '@/components/download-button';
import CommentThread from '@/components/comment-thread';

export default function MediaDetailPage() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const router = useRouter();
  const [media, setMedia] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/media/${mediaId}`).then((r) => r.json()).then(setMedia);
  }, [mediaId]);

  if (!media) return <div className="flex min-h-screen items-center justify-center text-text-tertiary">Chargement...</div>;

  const isVideo = media.fileType?.startsWith('video/');
  const time = media.takenAt
    ? new Date(media.takenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 bg-black/80 px-4 py-3">
        <button onClick={() => router.back()} className="text-lg text-white">&larr;</button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-medium text-white">
            {media.guest?.name?.charAt(0)}
          </div>
          <span className="text-sm font-medium text-white">{media.guest?.name}</span>
          <span className="text-xs text-white/60">{time}</span>
        </div>
      </div>

      {/* Media */}
      <div className="flex flex-1 items-center justify-center">
        {isVideo ? (
          <video
            src={`/api/media/file/${media.fileUrl}`}
            controls
            className="max-h-[70vh] w-full object-contain"
          />
        ) : (
          <img
            src={`/api/media/file/${media.fileUrl}`}
            alt=""
            className="max-h-[70vh] w-full object-contain"
          />
        )}
      </div>

      {/* Actions + Comments */}
      <div className="rounded-t-2xl bg-white p-4">
        <div className="mb-3 flex items-center gap-4">
          <ReactionButton mediaId={mediaId} initialCount={0} initialReacted={false} />
          <div className="ml-auto text-text-secondary">
            <DownloadButton fileUrl={media.fileUrl} />
          </div>
        </div>

        {media.caption && (
          <p className="mb-3 text-[13px] text-text-secondary">
            <span className="font-medium text-text">{media.guest?.name}</span>{' '}{media.caption}
          </p>
        )}

        <CommentThread mediaId={mediaId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(main\)/challenges/ src/app/\(main\)/moments/ src/app/\(main\)/leaderboard/ src/app/media/ src/components/challenge-card.tsx src/components/moment-node.tsx src/components/comment-thread.tsx
git commit -m "feat: add challenges, moments, leaderboard, and media detail pages"
```

---

## Phase 9 — Admin Dashboard

### Task 20: Admin auth + dashboard

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/login/page.tsx`, `src/app/admin/page.tsx`, `src/app/admin/challenges/page.tsx`, `src/app/admin/moments/page.tsx`, `src/components/qr-generator.tsx`

- [ ] **Step 1: Create admin login page**

`src/app/admin/login/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Mot de passe incorrect');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-center font-serif text-xl">Admin — Regards</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className="w-full rounded-lg border border-border px-4 py-3 outline-none focus:border-primary"
        />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button type="submit" className="w-full rounded-lg bg-primary py-3 text-white">
          Accéder
        </button>
      </form>
    </div>
  );
}
```

Create the admin login API: `src/app/api/admin/login/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { setAdminSession } from '@/lib/auth';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await setAdminSession();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create admin layout (auth gate)**

`src/app/admin/layout.tsx`:
```tsx
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await getAdminSession();

  // Allow login page without auth
  return <>{children}</>;
}
```

- [ ] **Step 3: Create admin dashboard page**

`src/app/admin/page.tsx`:
```tsx
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { guests, media } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) redirect('/admin/login');

  const totalGuests = await db.select({ count: sql<number>`count(*)` }).from(guests);
  const totalMedia = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.processingStatus, 'done'));
  const pendingSync = await db.select({ count: sql<number>`count(*)` }).from(media).where(eq(media.driveSynced, false));
  const totalVideos = await db.select({ count: sql<number>`count(*)` }).from(media).where(sql`file_type LIKE 'video/%'`);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 font-serif text-2xl">Dashboard — Regards</h1>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-card bg-bg-secondary p-4">
          <p className="text-2xl font-medium">{totalGuests[0].count}</p>
          <p className="text-sm text-text-secondary">Invités</p>
        </div>
        <div className="rounded-card bg-bg-secondary p-4">
          <p className="text-2xl font-medium">{totalMedia[0].count}</p>
          <p className="text-sm text-text-secondary">Photos & vidéos</p>
        </div>
        <div className="rounded-card bg-bg-secondary p-4">
          <p className="text-2xl font-medium">{totalVideos[0].count}</p>
          <p className="text-sm text-text-secondary">Vidéos</p>
        </div>
        <div className="rounded-card bg-bg-secondary p-4">
          <p className="text-2xl font-medium">{pendingSync[0].count}</p>
          <p className="text-sm text-text-secondary">En attente Drive</p>
        </div>
      </div>

      <div className="space-y-3">
        <a href="/admin/challenges" className="block rounded-card border border-border p-4">
          Gérer les défis &rarr;
        </a>
        <a href="/admin/moments" className="block rounded-card border border-border p-4">
          Gérer les moments &rarr;
        </a>
        <form action="/api/sync-drive" method="POST">
          <button type="submit" className="w-full rounded-card bg-primary p-4 text-white">
            Forcer la sync Drive
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create QR generator component**

`src/components/qr-generator.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRGenerator({ url }: { url: string }) {
  const [svgData, setSvgData] = useState('');

  useEffect(() => {
    QRCode.toString(url, {
      type: 'svg',
      width: 400,
      margin: 2,
      color: { dark: '#5B6B52', light: '#FAF8F5' },
    }).then(setSvgData);
  }, [url]);

  function handleDownload() {
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'regards-qr-code.svg';
    link.click();
  }

  return (
    <div className="text-center">
      <div dangerouslySetInnerHTML={{ __html: svgData }} className="mx-auto w-48" />
      <p className="mt-2 text-sm text-text-secondary">{url}</p>
      <button onClick={handleDownload} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-white">
        Télécharger le QR code (SVG)
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/ src/app/api/admin/ src/components/qr-generator.tsx
git commit -m "feat: add admin dashboard with login, stats, QR code generator"
```

---

## Phase 10 — PWA & Final Polish

### Task 21: PWA manifest + service worker

**Files:**
- Create: `public/manifest.json`, `public/sw.js`

- [ ] **Step 1: Create PWA manifest**

`public/manifest.json`:
```json
{
  "name": "Regards — Malachie & Jessica",
  "short_name": "Regards",
  "description": "Partagez vos regards sur notre mariage",
  "start_url": "/feed",
  "display": "standalone",
  "background_color": "#FAF8F5",
  "theme_color": "#5B6B52",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create service worker**

`public/sw.js`:
```javascript
const CACHE_NAME = 'regards-v1';
const STATIC_ASSETS = [
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache thumbnails (cache-first)
  if (url.pathname.includes('/api/media/file/media/thumbnails/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
```

- [ ] **Step 3: Register service worker in root layout**

Add to `src/app/layout.tsx`, inside the `<body>` tag at the end:
```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');
      }
    `,
  }}
/>
```

- [ ] **Step 4: Create placeholder icons**

Generate simple 192x192 and 512x512 PNG icons. For now, create placeholder files:
```bash
# Create simple SVG-based icons (placeholder — replace with designed icons before launch)
npx tsx -e "
const sharp = require('sharp');
const svg = '<svg width=\"512\" height=\"512\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"512\" height=\"512\" fill=\"#5B6B52\" rx=\"80\"/><text x=\"50%\" y=\"55%\" font-family=\"serif\" font-size=\"200\" fill=\"#FAF8F5\" text-anchor=\"middle\" dominant-baseline=\"middle\">M&J</text></svg>';
sharp(Buffer.from(svg)).resize(192).png().toFile('public/icon-192.png');
sharp(Buffer.from(svg)).resize(512).png().toFile('public/icon-512.png');
"
```

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json public/sw.js public/icon-*.png src/app/layout.tsx
git commit -m "feat: add PWA manifest, service worker with thumbnail caching, and app icons"
```

---

### Task 22: Toast notifications for badges

**Files:**
- Create: `src/components/toast.tsx`
- Modify: `src/app/(main)/layout.tsx`

- [ ] **Step 1: Create toast component**

`src/components/toast.tsx`:
```tsx
'use client';

import { useState, useCallback } from 'react';
import { useSSE } from '@/hooks/use-sse';

const BADGE_ICONS: Record<string, string> = {
  'Premier regard': '\u26A1',
  'Paparazzi': '\uD83D\uDCF8',
  'Vidéaste': '\uD83C\uDFAC',
  'Social butterfly': '\uD83E\uDD8B',
  'Chasseur de défis': '\uD83C\uDFC6',
  'Noctambule': '\uD83C\uDF19',
  'Fan #1': '\u2764\uFE0F',
  'Regard d\'or': '\uD83D\uDC51',
};

type Toast = { id: number; message: string; icon: string };

export default function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, icon: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useSSE({
    badge_unlocked: (data: { badge: string }) => {
      addToast(`Badge débloqué : ${data.badge}`, BADGE_ICONS[data.badge] || '\uD83C\uDF1F');
    },
    challenge_unlocked: (data: { title: string }) => {
      addToast(`Nouveau défi : ${data.title}`, '\u2B50');
    },
  });

  return (
    <div className="fixed left-4 right-4 top-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-[slideDown_0.3s_ease-out] rounded-card bg-white px-4 py-3 shadow-lg"
        >
          <span className="mr-2">{toast.icon}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add ToastProvider to main layout**

Modify `src/app/(main)/layout.tsx`:
```tsx
import BottomNav from '@/components/bottom-nav';
import ToastProvider from '@/components/toast';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-20">
      <ToastProvider />
      {children}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Add slideDown animation to globals.css**

Add to `src/app/globals.css`:
```css
@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/toast.tsx src/app/\(main\)/layout.tsx src/app/globals.css
git commit -m "feat: add toast notifications for badges and challenge unlocks"
```

---

### Task 23: Drizzle relations + final wiring

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add Drizzle relations for query API**

Add to the end of `src/lib/db/schema.ts`:
```typescript
import { relations } from 'drizzle-orm';

export const guestsRelations = relations(guests, ({ many }) => ({
  media: many(media),
  reactions: many(reactions),
  comments: many(comments),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  guest: one(guests, { fields: [media.guestId], references: [guests.id] }),
  challenge: one(challenges, { fields: [media.challengeId], references: [challenges.id] }),
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add Drizzle relations for relational queries"
```

---

### Task 24: End-to-end smoke test

- [ ] **Step 1: Start all services**

```bash
docker compose -f docker-compose.dev.yml up -d
npm run db:push
npm run db:seed
npm run dev
```

- [ ] **Step 2: Test the complete flow**

1. Open http://localhost:3000 — Welcome page
2. Click "Rejoindre" → Fill name "Sophie", select "Amie de la mariée" → Submit
3. Redirected to /feed — Empty feed, avatar row visible
4. Click camera (bottom nav) → Upload page
5. Select a photo from gallery → Preview appears → Add caption → Send
6. Back on /feed → Photo appears (after processing)
7. Click on photo → Detail view with reactions and comments
8. Click heart → Reaction count increases
9. Type a comment → Comment appears
10. Go to /challenges → 10 challenges listed, locked ones greyed
11. Go to /moments → 5 moments in timeline
12. Go to /leaderboard → Sophie appears with points
13. Open /admin/login → Enter password → Dashboard with stats
14. Download button visible on all media

- [ ] **Step 3: Fix any issues found during smoke test**

Address any console errors or broken functionality.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: address smoke test issues"
```

---

## Google Cloud Setup Guide (for the wedding couple)

This is not a code task — it's a manual setup to be done once before the wedding.

1. Go to https://console.cloud.google.com
2. Create a new project named "Regards"
3. Enable "Google Drive API"
4. Go to "IAM & Admin" → "Service Accounts" → Create
5. Name: "regards-sync", Role: none needed (Drive is shared separately)
6. Create a key (JSON), download it
7. On Google Drive, create folder "Regards - Malachie & Jessica"
8. Inside, create "_Tous les moments" folder
9. Right-click the root folder → Share → Add the service account email as Editor
10. Copy the folder IDs from the URL and update the `config` table:
    ```sql
    UPDATE config SET value = '{"folder_id": "PASTE_ROOT_ID", "all_moments_folder_id": "PASTE_MOMENTS_ID"}' WHERE key = 'drive';
    ```
11. Set `GOOGLE_SERVICE_ACCOUNT_KEY` env var to the contents of the JSON key file
