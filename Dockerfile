# Stage 1: Build the frontend
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code (from root)
COPY . .

# Build the frontend (Vite)
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# COPY THE CORRECT FILES (FROM ROOT, NOT /server)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/server-data.js ./

# Expose port and start
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]

