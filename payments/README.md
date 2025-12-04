# Payments Service

A microservice for payment processing built with NestJS. This service handles payment initiation, status tracking, webhook processing, and integration with multiple payment providers.

## Overview

The Payments Service is responsible for processing payments in the Opareta platform. It supports multiple payment methods and providers, handles payment status updates via webhooks, and maintains payment transaction records.

## Features

- 💳 **Payment Processing** - Initiate and manage payments
- 🔄 **Multiple Payment Providers** - Support for various payment providers (e.g., MTN Mobile Money)
- 📊 **Payment Status Tracking** - Track payment status through lifecycle (INITIATED → PENDING → SUCCESS/FAILED)
- 🔔 **Webhook Handling** - Process payment status updates from providers with idempotency
- 🔐 **JWT Authentication** - Secure endpoints using JWT tokens from Auth Service
- 💰 **Multi-Currency Support** - Support for multiple currencies
- 📈 **Health Checks** - Built-in health check endpoints for monitoring
- 📊 **Metrics** - Prometheus metrics endpoint for observability
- 📝 **API Documentation** - Swagger/OpenAPI documentation
- 🗄️ **Database Migrations** - Automatic Prisma migrations on startup
- 🌱 **Database Seeding** - Automatic database seeding on startup
- 📋 **Structured Logging** - Winston-based logging with daily rotation
- 🔒 **Redis Integration** - Redis for caching and distributed locking

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL 16 (via Prisma ORM)
- **Cache**: Redis (ioredis)
- **Authentication**: JWT (validated via Auth Service)
- **HTTP Client**: Axios
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston with daily rotate file
- **Metrics**: Prometheus client
- **Distributed Locking**: Redis-based locking for concurrency control

## Prerequisites

- Node.js 20+
- pnpm (package manager)
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (for containerized deployment)
- Access to Auth Service for JWT validation

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

4. Run database migrations and seed:
```bash
pnpm prisma migrate deploy
pnpm prisma db seed
```

## Configuration

### Environment Variables

Create a `.env` file in the `payments` directory with the following variables:

```env
# Server Configuration
PORT=3002
NODE_ENV=development

# Auth Service Configuration
AUTH_SERVICE_URL=http://localhost:3001

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=payments_user
DATABASE_PASSWORD=payments_password
DATABASE_NAME=payments_db
DATABASE_URL=postgresql://payments_user:payments_password@localhost:5432/payments_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Payment Provider Configuration
# Add provider-specific configuration here
# Example for MTN:
# MTN_API_URL=https://api.mtn.com
# MTN_API_KEY=your-api-key
# MTN_SUBSCRIPTION_KEY=your-subscription-key
```

## API Endpoints

### Payment Endpoints

All payment endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

#### Create Payment
```http
POST /payments
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "customer_phone": "+1234567890",
  "customer_email": "customer@example.com",  // optional
  "amount": 100.50,
  "currency": "USD",
  "payment_method": "mobile_money"
}
```

**Response:**
```json
{
  "id": 1,
  "reference_id": "PAY-1234567890-ABC123",
  "customer_phone": "+1234567890",
  "customer_email": "customer@example.com",
  "amount": 100.50,
  "status": "PENDING",
  "payment_method": "mobile_money",
  "currency": "USD",
  "provider_transaction_id": "MTN-123456",
  "provider_name": "mtn",
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

#### Get Payment by Reference
```http
GET /payments/:payment_reference_id
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "id": 1,
  "reference_id": "PAY-1234567890-ABC123",
  "customer_phone": "+1234567890",
  "customer_email": "customer@example.com",
  "amount": 100.50,
  "status": "SUCCESS",
  "payment_method": "mobile_money",
  "currency": "USD",
  "provider_transaction_id": "MTN-123456",
  "provider_name": "mtn",
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

#### Update Payment Status (Callback)
```http
POST /payments/callback
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "payment_reference_id": "PAY-1234567890-ABC123",
  "status": "SUCCESS",
  "provider_transaction_id": "MTN-123456"
}
```

#### Webhook Endpoint (Public)
```http
POST /payments/webhook
Content-Type: application/json

{
  "payment_reference_id": "PAY-1234567890-ABC123",
  "status": "SUCCESS",
  "provider_transaction_id": "MTN-123456",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**Note**: The webhook endpoint is public (no authentication required) and implements idempotency to prevent duplicate processing.

### Health & Monitoring

- `GET /health` - Health check endpoint (includes Redis health)
- `GET /metrics` - Prometheus metrics endpoint

## Database Schema

The service uses Prisma ORM with the following schema:

```prisma
enum PaymentStatus {
  INITIATED
  PENDING
  SUCCESS
  FAILED
}

model Currency {
  id         Int      @id @default(autoincrement())
  name       String   @unique
  payments   Payment[]
}

model PaymentProvider {
  id              Int             @id @default(autoincrement())
  name            String          @unique
  payment_methods PaymentMethod[]
  payments        Payment[]
}

model PaymentMethod {
  id                  Int             @id @default(autoincrement())
  name                String          @unique
  description         String?
  payment_provider_id Int
  payment_provider    PaymentProvider @relation(...)
  payments            Payment[]
}

model Payment {
  id                      Int              @id @default(autoincrement())
  reference_id            String           @unique
  customer_phone          String
  customer_email          String?
  amount                  Float
  status                  PaymentStatus    @default(INITIATED)
  payment_method_id       Int
  currency_id             Int
  provider_transaction_id String?
  provider_name           String?
  payment_method          PaymentMethod    @relation(...)
  currency                Currency         @relation(...)
  paymentProvider         PaymentProvider? @relation(...)
  webhook_events          WebhookEvent[]
}

model WebhookEvent {
  id                      Int           @id @default(autoincrement())
  payment_reference_id    String        @unique
  status                  PaymentStatus
  provider_transaction_id String        @unique
  timestamp               DateTime
  is_processed            Boolean       @default(false)
  payment                 Payment?      @relation(...)
}
```

## Payment Providers

The service supports multiple payment providers through a provider interface. Currently implemented:

- **MTN Mobile Money** - Mobile money payment processing

### Adding a New Payment Provider

1. Create a new provider class implementing `PaymentProvider` interface:
```typescript
// src/payments/providers/new-provider.provider.ts
export class NewProvider implements PaymentProvider {
  async initiatePayment(...): Promise<InitiatePaymentResponse> { }
  async checkPaymentStatus(...): Promise<CheckPaymentStatusResponse> { }
  getProviderName(): string { return 'new_provider'; }
}
```

2. Register the provider in the payments module
3. Add provider configuration to environment variables
4. Seed the database with payment method and provider data

## Running the Service

### Development Mode

```bash
pnpm start:dev
```

The service will start on `http://localhost:3002` (or the port specified in `PORT` environment variable).

### Production Mode

```bash
pnpm build
pnpm start:prod
```

### Docker

The service can be run using Docker Compose from the root directory:

```bash
docker-compose up payments
```

Or build and run individually:

```bash
docker build -t payments-service .
docker run -p 3002:3002 --env-file .env payments-service
```

**Note**: The Dockerfile automatically runs migrations and seeds the database on startup.

## Health Checks

The service includes health check endpoints for monitoring:

- **Health Check**: `GET /health` (includes Redis connectivity check)
- **Metrics**: `GET /metrics`

Health checks are configured in Docker Compose to verify service availability.

## API Documentation

Swagger documentation is available at:
```
http://localhost:3002/api/docs
```

The documentation includes:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Example requests and responses

## Development

### Project Structure

```
payments/
├── src/
│   ├── payments/           # Payment processing module
│   │   ├── dto/           # Data Transfer Objects
│   │   ├── providers/     # Payment provider implementations
│   │   ├── payments.controller.ts
│   │   ├── payments.service.ts
│   │   └── payments.repository.ts
│   ├── auth/              # JWT authentication guard
│   ├── common/            # Shared utilities
│   │   ├── database/      # Prisma service
│   │   ├── decorators/    # Custom decorators (e.g., @Public)
│   │   ├── filters/       # Exception filters
│   │   ├── interceptors/  # Request interceptors
│   │   └── logger/        # Logging configuration
│   ├── health/            # Health check module (includes Redis)
│   ├── metrics/           # Metrics module
│   └── main.ts            # Application entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Database migrations
│   └── seed.ts            # Database seed script
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

# Seed database
pnpm prisma db seed

# View database in Prisma Studio
pnpm prisma studio
```

## Logging

Logs are written to the `logs/` directory with daily rotation:
- `YYYY-MM-DD-combined.log` - All logs
- `YYYY-MM-DD-error.log` - Error logs only

## Security Considerations

- JWT token validation via Auth Service
- Input validation using class-validator
- Webhook idempotency to prevent duplicate processing
- Redis-based distributed locking for concurrency control
- CORS enabled for cross-origin requests
- Environment variables for sensitive configuration

## Integration

This service integrates with:
- **Auth Service** - JWT token validation for authenticated requests
- **Nginx** - Reverse proxy and load balancer
- **Redis** - Caching and distributed locking
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization
- **Payment Providers** - External payment gateway APIs

## Webhook Processing

The service implements idempotent webhook processing:

1. Webhook events are stored in the `WebhookEvent` table
2. Each webhook is identified by `provider_transaction_id` (unique)
3. Duplicate webhooks are detected and ignored
4. Payment status updates are processed atomically

## Scaling

The service is designed to be horizontally scalable. Multiple instances can be run behind a load balancer:

```bash
docker-compose up --scale payments=2
```

Each instance:
- Maintains its own database connection pool
- Shares Redis for distributed locking and caching
- Can handle requests independently
- Processes webhooks with idempotency guarantees

## Payment Status Flow

```
INITIATED → PENDING → SUCCESS
                    ↘ FAILED
```

- **INITIATED**: Payment created, not yet sent to provider
- **PENDING**: Payment sent to provider, awaiting response
- **SUCCESS**: Payment completed successfully
- **FAILED**: Payment failed or was rejected

