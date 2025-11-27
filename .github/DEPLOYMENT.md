# Zero-Downtime Deployment Guide

This document describes the zero-downtime deployment automation for the Opareta application.

## Overview

The deployment system provides:
- **Rolling Updates**: Updates one instance at a time to maintain service availability
- **Health Checks**: Validates each instance before proceeding to the next
- **Automatic Rollback**: Reverts to previous state if deployment fails
- **Deployment Validation**: Verifies service health and functionality after deployment

## Architecture

### Deployment Strategy

The deployment uses a **rolling update** strategy:

1. **Scale Down**: Reduce service instances by 1
2. **Update**: Build and start new instance with updated code
3. **Health Check**: Wait for new instance to pass health checks
4. **Repeat**: Continue until all instances are updated
5. **Validate**: Perform comprehensive validation of deployed services

### Services

The deployment system supports:
- **auth**: Authentication service (port 3001)
- **payments**: Payments service (port 3002)
- **nginx**: Reverse proxy and load balancer (ports 80, 443)
- **all**: Deploy all services

## Setup

### GitHub Secrets (for remote deployment)

If deploying to a remote server, configure these secrets in GitHub:

1. **DEPLOY_SSH_KEY**: Private SSH key for accessing the deployment server
2. **DEPLOY_HOST**: Hostname or IP address of the deployment server
3. **DEPLOY_USER**: SSH username for the deployment server

**To configure:**
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Add the required secrets

**For local/self-hosted runner deployment:**
- Leave secrets unset to deploy on the runner itself

### Local Setup

For local testing, ensure:
- Docker and Docker Compose are installed
- Services are accessible on `localhost:80` (nginx)
- Health endpoints are accessible

## GitHub Actions Workflow

### Automatic Deployment

Deployments are triggered automatically on:
- Push to `main` or `master` branch
- Manual workflow dispatch

### Workflow Steps

1. **Checkout Code**: Retrieves latest code from repository
2. **Build Images**: Builds Docker images for changed services
3. **Save State**: Records deployment metadata for rollback
4. **Rolling Update**: Performs zero-downtime deployment
5. **Validation**: Verifies deployment success
6. **Rollback**: Automatically reverts on failure

### Manual Deployment

To manually trigger a deployment:

```bash
# Via GitHub UI:
# Actions → Zero-Downtime Deployment → Run workflow

# Or via GitHub CLI:
gh workflow run deploy.yml -f service=all
```

Options:
- **service**: `auth`, `payments`, or `all` (default: `all`)
- **skip_validation**: Skip deployment validation (default: `false`)

## Local Deployment Scripts

### Rolling Deployment

Deploy services with zero-downtime:

```bash
# Deploy all services
./.github/scripts/deploy-rolling.sh all

# Deploy specific service
./.github/scripts/deploy-rolling.sh auth
./.github/scripts/deploy-rolling.sh payments
```

**Parameters:**
- `SERVICE`: Service to deploy (`auth`, `payments`, or `all`)
- `HEALTH_TIMEOUT`: Maximum time to wait for health check (default: 120s)
- `HEALTH_INTERVAL`: Interval between health check attempts (default: 5s)

**Example:**
```bash
./.github/scripts/deploy-rolling.sh auth 180 10
```

### Deployment Validation

Validate deployed services:

```bash
# Validate all services
./.github/scripts/validate-deployment.sh all

# Validate specific service
./.github/scripts/validate-deployment.sh auth
./.github/scripts/validate-deployment.sh payments
```

**Checks Performed:**
- Service instance count
- Health endpoint accessibility
- Basic functionality tests

### Rollback

Rollback failed deployments:

```bash
# Rollback all services
./.github/scripts/rollback.sh all

# Rollback specific service
./.github/scripts/rollback.sh auth
./.github/scripts/rollback.sh payments
```

**Parameters:**
- `SERVICE`: Service to rollback (`auth`, `payments`, or `all`)
- `MAX_ATTEMPTS`: Maximum rollback attempts (default: 3)

**Rollback Strategy:**
1. **Simple Rollback**: Restart service without rebuild (uses existing images)
2. **Full Rollback**: Rebuild from previous commit if simple rollback fails

## Health Checks

### Service Health Endpoints

- **Auth Service**: `http://localhost/auth/health` or `http://localhost:3001/health`
- **Payments Service**: `http://localhost/payments/health` or `http://localhost:3002/health`
- **Nginx**: `http://localhost/nginx-health`

### Health Check Configuration

Health checks are configured in `docker-compose.yml`:

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Deployment Process

### Step-by-Step Flow

1. **Determine Services**: Identify which services changed
2. **Build Images**: Build Docker images for changed services
3. **Save State**: Record current deployment state for rollback
4. **Rolling Update**:
   - For each service instance:
     - Scale down by 1
     - Build and start new instance
     - Wait for health check
     - Verify instance is healthy
     - Proceed to next instance
5. **Validation**: Verify all services are healthy and functional
6. **Rollback** (if needed): Revert to previous state on failure

### Example Deployment Log

```
[INFO] Starting zero-downtime deployment for: all
[INFO] Health check timeout: 120s, interval: 5s
[INFO] Starting rolling update for auth...
[INFO] Current auth instances: 2
[INFO] Updating instance 1 of auth...
[INFO] Scaling auth down to 1 instances...
[INFO] Scaling auth back up to 2 instances with new image...
[INFO] Waiting for new auth instance to be healthy...
[INFO] Checking health for auth (max 24 attempts, 5s interval)...
[INFO] auth is healthy!
[INFO] Instance 1 of auth updated successfully
[INFO] Rolling update for auth completed successfully!
[INFO] Deployment completed successfully!
```

## Troubleshooting

### Deployment Fails During Rolling Update

**Symptoms:**
- Health check fails for new instance
- Service becomes unavailable

**Solution:**
1. Check service logs: `docker-compose logs <service>`
2. Verify health endpoint: `curl http://localhost/<service>/health`
3. Check Docker container status: `docker-compose ps`
4. Manual rollback: `./.github/scripts/rollback.sh <service>`

### Rollback Fails

**Symptoms:**
- Rollback script cannot restore previous state
- Services remain in failed state

**Solution:**
1. Check deployment state: `cat .deployment/commit_sha`
2. Manually restore previous commit:
   ```bash
   git checkout <previous-commit>
   docker-compose up -d --build
   ```
3. Verify services: `docker-compose ps`

### Health Check Timeout

**Symptoms:**
- Health checks take too long
- Deployment times out

**Solution:**
1. Increase timeout: `./.github/scripts/deploy-rolling.sh <service> 300 10`
2. Check service startup time in logs
3. Verify health endpoint is accessible
4. Check for resource constraints (CPU, memory)

## Best Practices

1. **Test Locally**: Always test deployment scripts locally before pushing
2. **Monitor Logs**: Watch deployment logs during rollout
3. **Gradual Rollout**: Deploy to staging before production
4. **Backup State**: Ensure deployment state is saved before updates
5. **Health Checks**: Verify health endpoints are working before deployment
6. **Rollback Plan**: Always have a rollback plan ready

## Environment Variables

The deployment scripts use environment variables from:
- `.env` files in service directories
- `docker-compose.yml` environment section
- GitHub Actions secrets (for production)

## Monitoring

After deployment, monitor:
- Service health endpoints
- Application logs
- System metrics (CPU, memory, disk)
- Error rates
- Request latency

Use Grafana dashboards to monitor deployment impact.

## Manual Rollback Commands

If automated rollback fails, use these commands:

```bash
# Stop and remove service
docker-compose stop <service>
docker-compose rm -f <service>

# Restart without rebuild (uses existing images)
docker-compose up -d --no-build --scale <service>=2 <service>

# Or rebuild from previous commit
git checkout <previous-commit>
docker-compose up -d --build --scale <service>=2 <service>
git checkout -  # Return to current branch
```

## Support

For issues or questions:
1. Check deployment logs in GitHub Actions
2. Review service logs: `docker-compose logs <service>`
3. Verify health endpoints are accessible
4. Check Docker container status

