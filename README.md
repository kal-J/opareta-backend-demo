# Opareta Platform

A microservices-based payment platform built with NestJS, featuring authentication, payment processing, automated backups, and comprehensive monitoring.

## Overview

Opareta is a scalable payment processing platform that provides:
- 🔐 **User Authentication & Authorization** - JWT-based authentication service
- 💳 **Payment Processing** - Multi-provider payment handling with webhook support
- 🔄 **Load Balancing** - Nginx reverse proxy with automatic load distribution
- 💾 **Automated Backups** - Daily database backups with retention policies
- 📊 **Monitoring & Observability** - Prometheus metrics and Grafana dashboards

## Architecture

The platform consists of the following services:

### Core Services

- **Auth Service** (`auth/`) - User registration, login, and JWT token management
- **Payments Service** (`payments/`) - Payment processing with multiple provider support
- **Nginx** (`nginx/`) - Reverse proxy, load balancer, SSL/TLS termination, and rate limiting

### Supporting Services

- **PostgreSQL Databases** - Separate databases for auth and payments services
- **Redis** - Caching and distributed locking
- **Backup Service** (`backups/`) - Automated daily database backups
- **Monitoring Stack** (`monitoring/`) - Prometheus, Grafana, and various exporters

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- pnpm (for local development)

### Start All Services

```bash
# Start all services
docker-compose up -d

# Start with scaling (2 instances of each service)
docker-compose up -d --scale auth=2 --scale payments=2

# View logs
docker-compose logs -f
```

### Access Services

- **Nginx (API Gateway)**: http://localhost (HTTP) / https://localhost (HTTPS)
- **Auth Service**: http://localhost/auth
- **Payments Service**: http://localhost/payments
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

### Health Checks

```bash
# Nginx health
curl http://localhost/nginx-health

# Auth service health
curl http://localhost/auth/health

# Payments service health
curl http://localhost/payments/health
```

## Documentation

### Service Documentation

- **[Auth Service](auth/README.md)** - Authentication and authorization service documentation
  - User registration and login
  - JWT token management
  - API endpoints and configuration

- **[Payments Service](payments/README.md)** - Payment processing service documentation
  - Payment initiation and tracking
  - Webhook handling
  - Multi-provider support

- **[Nginx Configuration](nginx/README.md)** - Reverse proxy and load balancer documentation
  - Load balancing configuration
  - SSL/TLS setup
  - Rate limiting and health checks
  - **[Scaling Guide](nginx/SCALING.md)** - How to scale services horizontally

- **[Backup System](backups/README.md)** - Automated backup service documentation
  - Backup scheduling and retention
  - Backup management
  - **[Restore Guide](backups/RESTORE_GUIDE.md)** - Step-by-step database restore instructions

- **[Monitoring Setup](monitoring/README.md)** - Monitoring and observability documentation
  - Prometheus configuration
  - Grafana dashboards
  - Alert rules and metrics

## Tech Stack

### Backend
- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL 16 (Prisma ORM)
- **Cache**: Redis 7
- **Authentication**: JWT (Passport.js)

### Infrastructure
- **Reverse Proxy**: Nginx
- **Containerization**: Docker & Docker Compose
- **Monitoring**: Prometheus, Grafana
- **Metrics Exporters**: Node Exporter, PostgreSQL Exporter, Redis Exporter, Nginx Exporter

## Project Structure

```
opareta/
├── auth/                 # Authentication service
│   ├── src/              # Source code
│   ├── prisma/           # Database schema and migrations
│   └── README.md         # Service documentation
├── payments/             # Payments service
│   ├── src/              # Source code
│   ├── prisma/           # Database schema and migrations
│   └── README.md         # Service documentation
├── nginx/                # Reverse proxy configuration
│   ├── conf.d/           # Nginx configuration files
│   ├── ssl/              # SSL certificates
│   ├── README.md         # Nginx documentation
│   └── SCALING.md        # Scaling guide
├── backups/              # Backup automation
│   ├── data/             # Backup files
│   ├── logs/             # Backup logs
│   ├── README.md         # Backup documentation
│   └── RESTORE_GUIDE.md  # Restore instructions
├── monitoring/           # Monitoring stack
│   ├── alerts/           # Prometheus alert rules
│   ├── grafana/          # Grafana dashboards
│   ├── prometheus.yml    # Prometheus configuration
│   └── README.md         # Monitoring documentation
└── docker-compose.yml    # Service orchestration
```

## API Endpoints

### Authentication Endpoints
- `POST /auth/register` - Register a new user
- `POST /auth/login` - User login
- `POST /auth/verify` - Verify JWT token

### Payment Endpoints
- `POST /payments` - Create a payment (requires JWT)
- `GET /payments/:reference_id` - Get payment by reference (requires JWT)
- `POST /payments/webhook` - Webhook endpoint for payment status updates

### Health & Monitoring
- `GET /health` - Service health check
- `GET /metrics` - Prometheus metrics endpoint

**Note**: All endpoints are accessible through Nginx at `http://localhost` or `https://localhost`.

## Development

### Local Development Setup

1. **Clone and navigate to service directory**:
   ```bash
   cd auth  # or payments
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run database migrations**:
   ```bash
   pnpm prisma generate
   pnpm prisma migrate deploy
   ```

5. **Start development server**:
   ```bash
   pnpm start:dev
   ```

See individual service READMEs for detailed development instructions:
- [Auth Service Development](auth/README.md#development)
- [Payments Service Development](payments/README.md#development)

## Scaling

The platform is designed for horizontal scaling. Services can be scaled independently:

```bash
# Scale auth service to 3 instances
docker-compose up -d --scale auth=3

# Scale payments service to 3 instances
docker-compose up -d --scale payments=3

# Scale both services
docker-compose up -d --scale auth=3 --scale payments=3
```

Nginx automatically distributes traffic across all instances using round-robin load balancing.

For detailed scaling instructions, see the [Nginx Scaling Guide](nginx/SCALING.md).

## Backup & Restore

### Automated Backups

Backups run automatically daily at 2:00 AM:
- 7-day retention policy
- Compressed SQL dumps
- Automatic cleanup of old backups

### Manual Backup

```bash
docker exec db-backups /usr/local/bin/backup-postgres.sh
```

### Restore Database

See the [Backup Restore Guide](backups/RESTORE_GUIDE.md) for detailed restore instructions.

For backup management, see the [Backup System Documentation](backups/README.md).

## Monitoring

### Access Dashboards

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

### Available Metrics

- Service health and availability
- Request rates and latency
- Payment success/failure rates
- System resources (CPU, memory, disk)
- Database connections and performance
- Redis queue depth and memory

For detailed monitoring setup and configuration, see the [Monitoring Documentation](monitoring/README.md).

## Security

- JWT-based authentication
- Password hashing with bcrypt
- SSL/TLS encryption (HTTPS)
- Rate limiting (100 req/min per IP)
- Input validation
- CORS configuration
- Environment-based configuration

## Contributing

1. Follow the project structure and conventions
2. Write tests for new features
3. Update relevant documentation
4. Ensure all services pass health checks
5. Follow the coding standards defined in each service

## Support

For issues or questions:
1. Check service-specific documentation in respective README files
2. Review logs: `docker-compose logs <service-name>`
3. Check health endpoints
4. Review monitoring dashboards

## License

[Add your license information here]

