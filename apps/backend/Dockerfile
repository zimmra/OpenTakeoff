# syntax=docker/dockerfile:1

# ============================================================================
# OpenTakeOff Backend Dockerfile
# Multi-stage build for Node.js 20 Alpine with pnpm workspace support
# ============================================================================

# Stage 1: Dependencies
# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace configuration and lock file
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all workspaces to enable proper dependency resolution
COPY apps/backend/package.json ./apps/backend/
COPY packages/*/package.json ./packages/*/

# Fetch dependencies using pnpm's optimized fetch command
RUN pnpm fetch --prod

# Install production dependencies offline for better caching
RUN pnpm install --frozen-lockfile --offline --prod

# Stage 2: Builder
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all workspace package.json files
COPY apps/backend/package.json ./apps/backend/
COPY packages/*/package.json ./packages/*/

# Install ALL dependencies (including devDependencies for build)
RUN pnpm fetch
RUN pnpm install --frozen-lockfile --offline

# Copy source code for backend and shared packages
COPY tsconfig.base.json ./
COPY apps/backend ./apps/backend
COPY packages ./packages

# Build the backend application
WORKDIR /app/apps/backend
RUN pnpm build

# Stage 3: Runtime
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/package.json ./apps/backend/
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/drizzle ./apps/backend/drizzle

# Copy shared packages if needed
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages

# Create data directories with proper permissions
RUN mkdir -p /data/uploads /data/sqlite && \
    chown -R nodejs:nodejs /data

# Switch to non-root user
USER nodejs

# Expose backend port (default 3001, configurable via PORT env var)
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production

# Health check endpoint (will be available after Task 3)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/backend/dist/index.js"]
