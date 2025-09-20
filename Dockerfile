# Use the official Bun image
FROM oven/bun:1-slim

# Set working directory
WORKDIR /app

# Copy package.json and bun.lockb (if exists)
COPY package.json ./
COPY bun.lockb* ./

# Install only production dependencies
RUN bun install --production --frozen-lockfile

# Copy source code (including pre-built admin files in src/www)
COPY src ./src

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 bunjs

# Change ownership of the app directory
RUN chown -R bunjs:nodejs /app
USER bunjs

# Expose port 80 for direct serving
EXPOSE 80

# Set environment variables
ENV NODE_ENV=production
ENV PORT=80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Start the application directly from source
CMD ["bun", "run", "src/index.ts"]
