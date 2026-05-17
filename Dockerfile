FROM node:22-alpine AS base

# Install ffmpeg for video thumbnails
RUN apk add --no-cache ffmpeg

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (not `npm ci`) because the lockfile was generated with npm 11
# and node:22-alpine ships with npm 10.x — `npm ci` would reject minor format
# diffs that npm install reconciles in place. Safe for a single-target deploy.
RUN npm install --no-audit --no-fund

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
