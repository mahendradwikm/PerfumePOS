# syntax=docker/dockerfile:1.7

###############################################################################
# MISYourPOS — production image
#
# Multi-stage build. The final image contains only the Next.js `standalone`
# server output plus static assets, so no full node_modules tree ships.
#
# Targets (selected via `--target` / compose `build.target`):
#   deps    — full dependency tree, used by the builder
#   migrate — prisma CLI + schema, for the one-shot schema sync service
#   builder — runs `prisma generate` + `next build`
#   runner  — final, minimal production image (default)
#
# No secrets are baked in. Everything sensitive arrives via runtime
# environment variables (see docker-compose.yml).
###############################################################################

# ----------------------------------------------------------------------------
# deps — full install (including devDependencies) for the build stage.
# Cached independently so source-only edits skip the install layer.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# Prisma's query engine needs glibc compatibility shims on musl-based Alpine.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci


# ----------------------------------------------------------------------------
# migrate — prisma CLI + schema, no dev/optional deps.
# Used as a one-shot service to sync the schema before the app boots.
# `--omit=optional` drops the embedded-postgres platform binaries, which are
# dev-only tooling and are not present for musl anyway.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS migrate
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --omit=optional
COPY prisma ./prisma


# ----------------------------------------------------------------------------
# seed — optional demo-data loader. Needs the full dev tree because the seed
# script is TypeScript and runs through `tsx`, plus a generated Prisma client.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS seed
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
RUN npx prisma generate


# ----------------------------------------------------------------------------
# builder — generate the Prisma client and produce the standalone build.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Consumed by next.config.ts to switch on `output: "standalone"` for this
# build only, leaving the host `npm run build` behaviour untouched.
ENV NEXT_OUTPUT_STANDALONE=true
RUN npm run build


# ----------------------------------------------------------------------------
# runner — final production image.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# openssl: needed by Prisma's engine loader on musl.
# nodejs/nextjs: unprivileged runtime user (never run as root).
RUN apk add --no-cache libc6-compat openssl \
 && addgroup -g 1001 -S nodejs \
 && adduser -S -G nodejs -u 1001 nextjs

# `standalone` already carries the traced node_modules subset it needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# The standalone server does not copy these automatically.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Fails the container healthcheck if the server stops serving /login.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]