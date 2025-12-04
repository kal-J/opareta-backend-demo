# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN pnpm prisma generate

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

# Install pnpm and wget for health checks
RUN npm install -g pnpm && apk add --no-cache wget

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Install Prisma CLI for migrations (needed in production)
RUN npm install -g prisma@^6.0.0

# Copy Prisma schema and migrations
COPY prisma ./prisma

# Generate Prisma Client (needed for production)
RUN prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE ${PORT:-3001}

# Run Prisma migrations and start the application
CMD ["sh", "-c", "prisma migrate deploy && node dist/main"]

