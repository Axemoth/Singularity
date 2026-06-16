FROM node:20-alpine AS base

# Install core dependencies and pnpm
RUN apk add --no-repeat --no-cache libc6-compat
RUN npm install -g pnpm@10.33.0

# 1. Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy lockfile and package config
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable to skip env validation during next build
ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production

RUN pnpm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a system user for safety
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and standalone outputs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Run the Next.js standalone server
CMD ["node", "server.js"]
