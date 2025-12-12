# Stage 1: Build the frontend
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies (layer caching optimization)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the frontend (Vite)
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built static files and server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/server-data.js ./

# Expose port
ENV PORT=8080
EXPOSE 8080

# Run as non-root user (security best practice)
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Start the server
CMD ["node", "server.js"]

