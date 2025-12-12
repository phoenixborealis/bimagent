# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install dependencies including dev dependencies for build
RUN npm install
COPY . .
# Build frontend
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app
# Copy dependencies
COPY package*.json ./
RUN npm install --omit=dev
# Copy built assets and server file from root
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/server-data.js ./

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]

