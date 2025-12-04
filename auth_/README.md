# Auth Service

A microservice for user authentication and authorization built with NestJS. This service provides JWT-based authentication, user registration, login, and token verification capabilities.

## Overview

The Auth Service is responsible for managing user accounts and authentication in the Opareta platform. It handles user registration, login, and JWT token generation/verification.

## Features

- 🔐 **User Registration** - Create new user accounts with email (optional), phone number, and password
- 🔑 **User Login** - Authenticate users with phone number and password
- ✅ **Token Verification** - Validate JWT tokens
- 🔒 **Password Hashing** - Secure password storage using bcrypt
- 📊 **Health Checks** - Built-in health check endpoints for monitoring
- 📈 **Metrics** - Prometheus metrics endpoint for observability
- 📝 **API Documentation** - Swagger/OpenAPI documentation
- 🗄️ **Database Migrations** - Automatic Prisma migrations on startup
- 📋 **Structured Logging** - Winston-based logging with daily rotation

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL 16 (via Prisma ORM)
- **Cache**: Redis
- **Authentication**: JWT (Passport.js)
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston with daily rotate file
- **Metrics**: Prometheus client

## Prerequisites

- Node.js 20+
- pnpm (package manager)
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (for containerized deployment)

## Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Generate Prisma Client:
```bash
pnpm prisma generate
```

4. Run database migrations:
```bash
pnpm prisma migrate deploy
```

## Configuration

### Environment Variables

Create a `.env` file in the `auth` directory with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-secret-key-here

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=auth_user
DATABASE_PASSWORD=auth_password
DATABASE_NAME=auth_db
DATABASE_URL=postgresql://auth_user:auth_password@localhost:5432/auth_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
```

## API Endpoints

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "phone_number": "+1234567890",
  "email": "user@example.com",  // optional
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": 1,
  "email": "user@example.com",
  "phone_number": "+1234567890"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "phone_number": "+1234567890",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": 1,
  "email": "user@example.com",
  "phone_number": "+1234567890"
}
```

#### Verify Token
```http
POST /auth/verify
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "valid": true,
  "user_id": 1,
  "phone_number": "+1234567890"
}
```

### Health & Monitoring

- `GET /health` - Health check endpoint
- `GET /metrics` - Prometheus metrics endpoint

## Database Schema

The service uses Prisma ORM with the following schema:

```prisma
model User {
  id           Int      @id @default(autoincrement())
  email        String?  @unique
  phone_number String   @unique
  password     String
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
}
```

## Running the Service

### Development Mode

```bash
pnpm start:dev
```

The service will start on `http://localhost:3001` (or the port specified in `PORT` environment variable).

### Production Mode

```bash
pnpm build
pnpm start:prod
```

### Docker

The service can be run using Docker Compose from the root directory:

```bash
docker-compose up auth
```

Or build and run individually:

```bash
docker build -t auth-service .
docker run -p 3001:3001 --env-file .env auth-service
```

## Health Checks

The service includes health check endpoints for monitoring:

- **Health Check**: `GET /health`
- **Metrics**: `GET /metrics`

Health checks are configured in Docker Compose to verify service availability.

## API Documentation

Swagger documentation is available at:
```
http://localhost:3001/api/docs
```

The documentation includes:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Example requests and responses

## Development

### Project Structure

```
auth/
├── src/
│   ├── auth/              # Authentication module
│   │   ├── dto/           # Data Transfer Objects
│   │   ├── strategies/    # Passport strategies
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.repository.ts
│   ├── users/             # User management module
│   ├── common/            # Shared utilities
│   │   ├── database/      # Prisma service
│   │   ├── filters/       # Exception filters
│   │   ├── interceptors/  # Request interceptors
│   │   └── logger/        # Logging configuration
│   ├── health/            # Health check module
│   ├── metrics/           # Metrics module
│   └── main.ts            # Application entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── test/                  # E2E tests
└── Dockerfile             # Docker configuration
```

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

### Code Quality

```bash
# Linting
pnpm lint

# Formatting
pnpm format
```

### Database Management

```bash
# Generate Prisma Client
pnpm prisma generate

# Create migration
pnpm prisma migrate dev --name migration_name

# Apply migrations
pnpm prisma migrate deploy

# View database in Prisma Studio
pnpm prisma studio
```

## Logging

Logs are written to the `logs/` directory with daily rotation:
- `YYYY-MM-DD-combined.log` - All logs
- `YYYY-MM-DD-error.log` - Error logs only

## Security Considerations

- Passwords are hashed using bcrypt
- JWT tokens are signed with a secret key
- Input validation using class-validator
- CORS enabled for cross-origin requests
- Environment variables for sensitive configuration

## Integration

This service is integrated with:
- **Payments Service** - Provides JWT token verification for authenticated payment requests
- **Nginx** - Reverse proxy and load balancer
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization

## Scaling

The service is designed to be horizontally scalable. Multiple instances can be run behind a load balancer:

```bash
docker-compose up --scale auth=2
```

Each instance maintains its own database connection pool and can handle requests independently.

