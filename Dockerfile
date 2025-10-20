# Multi-stage build for KMUC Dev CLI Webapp
FROM node:18-alpine AS base

# Stage 1: Dependencies
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and production dependencies
RUN npm install -g pnpm@10.15.1 && \
    pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# Stage 2: Build
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY webapp ./webapp
COPY src/utils/version.js ./src/utils/version.js
COPY package.json ./package.json

# Stage 3: Production
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 webapp

# Copy necessary files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/webapp ./webapp
COPY --from=builder /app/src/utils/version.js ./src/utils/version.js
COPY --from=builder /app/package.json ./package.json

# Change ownership to non-root user
RUN chown -R webapp:nodejs /app

# Switch to non-root user
USER webapp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the webapp server
CMD ["node", "webapp/server.js"]
