# Multi-stage build for recycling booker PWA

# Stage 1: Build client
FROM node:22-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:22-slim AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production runtime
FROM node:22-slim AS runtime

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libdrm2 \
    libgbm1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

# Install Puppeteer's Chrome
RUN npx puppeteer browsers install chrome

# Copy built server
COPY --from=server-builder /app/server/dist ./dist

# Copy built client
COPY --from=client-builder /app/client/dist ../client/dist

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
