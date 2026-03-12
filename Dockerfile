# Multi-stage Dockerfile for backend-cursala
# - builder stage: install dependencies (including dev) and compile TS
# - runner stage: install only production dependencies and run the compiled output

FROM node:24-alpine AS builder
WORKDIR /app

# Install common build tools
RUN apk add --no-cache python3 make g++

# Copy metadata and install ALL deps (including dev) for building
COPY package*.json ./
COPY package-lock.json ./
RUN npm ci --include=dev

# Copy source files
COPY . .

# Build the project (runs build.ts then tsc)
RUN npm run build && \
    echo "Build completed. Checking dist folder:" && \
    ls -la dist/ && \
    ls -la dist/src/ || echo "Build failed or dist not created"

FROM node:24-alpine AS runner
WORKDIR /app

# Do not copy secrets or .env to the image; expect env vars from the host or secret manager
# Copy only package metadata and install production deps
COPY package*.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    # sharp requires its native binary (pre-built for alpine/musl)
    npm rebuild sharp --ignore-scripts=false

# Copy built assets only
COPY --from=builder /app/dist ./dist

# Copy static assets (plantillas, etc.)
COPY --from=builder /app/src/static ./src/static

# Solo crear directorio de logs (imágenes/videos ahora en Bunny.net)
RUN mkdir -p /app/logs && chmod -R 755 /app/logs

# Add a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app /app/logs
USER appuser

EXPOSE 8080

# Start using Node source maps for nicer stack traces in production
CMD ["node", "--enable-source-maps", "./dist/src/index.js"]