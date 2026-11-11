# ==============================================================================
# FocusForge API Production Multi-Stage Dockerfile
# ==============================================================================

# --- Stage 1: Build & Prune ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root monorepo files and package manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy source trees
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package and api package
RUN npm run build --workspace=@focusforge/shared
RUN npm run build --workspace=api

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Create dedicated non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 focusforge

# Copy package manifests for production install
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Set ownership to non-root user
USER focusforge

EXPOSE 5000

# Health check directly against /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
