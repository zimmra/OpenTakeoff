# syntax=docker/dockerfile:1

# ============================================================================
# OpenTakeOff Frontend Dockerfile
# Multi-stage build: Node.js 20 Bullseye (build) → Caddy 2.7 (serve)
# ============================================================================

# Stage 1: Dependencies
# ----------------------------------------------------------------------------
FROM node:20-bullseye-slim AS deps

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace configuration and lock file
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all workspaces
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/*/package.json ./packages/*/

# Fetch dependencies using pnpm's optimized fetch command
RUN pnpm fetch --prod

# Install production dependencies offline for better caching
RUN pnpm install --frozen-lockfile --offline --prod

# Stage 2: Builder
# ----------------------------------------------------------------------------
FROM node:20-bullseye-slim AS builder

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all workspace package.json files
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/*/package.json ./packages/*/

# Install ALL dependencies (including devDependencies for build)
RUN pnpm fetch
RUN pnpm install --frozen-lockfile --offline

# Copy source code for frontend and shared packages
COPY tsconfig.base.json ./
COPY apps/frontend ./apps/frontend
COPY packages ./packages

# Build arguments for frontend configuration
ARG VITE_API_BASE_URL
ARG VITE_ENABLE_SENTRY
ARG VITE_SENTRY_DSN

# Make them available as environment variables during build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ENABLE_SENTRY=$VITE_ENABLE_SENTRY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Build the frontend application
# NOTE: Currently runs 'tsc' but will use 'vite build' after Task 11
WORKDIR /app/apps/frontend
RUN pnpm build

# Stage 3: Runtime (Caddy)
# ----------------------------------------------------------------------------
FROM caddy:2.7-alpine

# Create non-root user for Caddy
RUN addgroup -g 1001 -S caddy-user && \
    adduser -S caddy-user -u 1001 -G caddy-user

# Ensure Caddy directories exist and are writable
RUN mkdir -p /config/caddy /data/caddy && \
    chown -R caddy-user:caddy-user /config /data

# Copy built static assets from builder stage
COPY --from=builder --chown=caddy-user:caddy-user /app/apps/frontend/dist /srv

    # Copy Caddyfile
    COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile

# Expose HTTP port
EXPOSE 80

# Health check for Caddy
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Switch to non-root user
USER caddy-user

# Caddy runs automatically with the Caddyfile
