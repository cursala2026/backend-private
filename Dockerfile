# Multi-stage Dockerfile for backend-cursala
# - builder stage: install dependencies (including dev) and compile TS
# - runner stage: install only production dependencies and run the compiled output

FROM node:20-alpine AS builder
WORKDIR /app

# Install common build tools
RUN apk add --no-cache python3 make g++

# Copy metadata and install dev deps for building
COPY package*.json ./
COPY package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Do not copy secrets or .env to the image; expect env vars from the host or secret manager
# Copy only package metadata and install production deps
COPY package*.json ./
COPY package-lock.json ./
# Use legacy-peer-deps temporarily to avoid CI build failures caused by dev-time
# peer dependency conflicts (eslint / airbnb config). This allows the image to
# install production deps in environments with newer npm/eslint versions.
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built assets only
COPY --from=builder /app/dist ./dist

# Copy static assets (images, certificates, etc.)
COPY --from=builder /app/src/static ./src/static

# Create upload directories and logs with proper permissions before switching user
RUN mkdir -p /app/dist/src/static/images \
    /app/dist/src/static/files-public \
    /app/dist/src/static/profile-images \
    /app/dist/src/static/signatures \
    /app/dist/src/static/materials \
    /app/logs

# Add a non-root user for security
# RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
#     chown -R appuser:appgroup /app/dist/src/static /app/logs
# USER appuser

EXPOSE 8080

# Start using Node source maps for nicer stack traces in production
CMD ["node", "--enable-source-maps", "./dist/src/index.js"]
