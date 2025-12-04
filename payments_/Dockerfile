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

# Verify build output exists
RUN ls -la dist/src/ && test -f dist/src/main.js && echo "Build successful: dist/src/main.js exists" || (echo "Build failed: dist/src/main.js not found" && exit 1)

# Production stage
FROM node:20-alpine AS production

# Install pnpm and wget for health checks
RUN npm install -g pnpm && apk add --no-cache wget

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Install Prisma CLI and tsx for migrations and seeding (needed in production)
# tsx handles ESM modules better than ts-node
RUN npm install -g prisma@^6.0.0 tsx typescript

# Copy Prisma schema and migrations
COPY prisma ./prisma

# Generate Prisma Client (needed for production)
RUN prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Debug: List dist folder contents (remove in production if needed)
RUN ls -la dist/ || echo "Dist folder not found or empty"

EXPOSE ${PORT:-3002}

# Run Prisma migrations, seed the database and start the application
CMD ["sh", "-c", "prisma migrate deploy && prisma db seed && node dist/src/main"]
