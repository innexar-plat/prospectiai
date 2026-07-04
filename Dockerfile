# Multi-stage build for ProspectorAI Monorepo (Backend focus)
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json ./
# Copy workspace package.jsons to leverage caching
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY admin/package.json ./admin/
# Copy prisma directory for postinstall scripts
COPY backend/prisma ./backend/prisma/
RUN npm install --legacy-peer-deps

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build time
ARG NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=$NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client specifically for the backend schema
RUN npx prisma generate --schema=backend/prisma/schema.prisma
# Build the backend workspace
RUN npm run build:backend

# Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output for backend will be in backend/.next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/backend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/backend/.next/static ./backend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/backend/prisma ./prisma

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install Prisma CLI locally (owned by nextjs, not root global)
RUN mkdir -p /app/prisma-cli && chown nextjs:nodejs /app/prisma-cli

USER nextjs

# Pin Prisma CLI to 6.x to match schema format (local install, user-owned)
RUN cd /app/prisma-cli && npm init -y --scope=prisma-cli && npm install prisma@6
ENV PATH="/app/prisma-cli/node_modules/.bin:$PATH"

EXPOSE 4000

ENV PORT=4000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/entrypoint.sh"]
