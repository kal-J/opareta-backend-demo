# Scaling Services with Docker Compose & Round-Robin Load Balancing

This setup uses Docker Compose's built-in scaling feature with round-robin load balancing via Docker DNS.

## How It Works

1. **Single Service Definition**: Each service (auth, payments) is defined once in `docker-compose.yml`
2. **No Container Names**: Services don't have `container_name` set, allowing Docker to create multiple instances
3. **Docker DNS Round-Robin**: Docker Compose's internal DNS automatically resolves service names to all scaled instances
4. **Automatic Distribution**: Requests are distributed in round-robin fashion across all instances
5. **No Manual Configuration**: Scaling works automatically - just scale services and Docker handles the rest

## Scaling Commands

### Start with 2 instances of each service:
```bash
docker-compose up -d --scale auth=2 --scale payments=2
```

### Start with 3 instances of each service:
```bash
docker-compose up -d --scale auth=3 --scale payments=3
```

### Scale up after services are running:
```bash
docker-compose up -d --scale auth=3 --scale payments=3
```

### Scale down:
```bash
docker-compose up -d --scale auth=1 --scale payments=1
```

## Benefits

- ✅ **Easy Scaling**: Change the scale number without editing docker-compose.yml
- ✅ **Automatic Load Balancing**: Docker DNS handles distribution across instances

## Round-Robin Load Balancing Benefits

Using Docker DNS round-robin provides:
- **Simplicity**: No manual configuration or scripts needed
- **Automatic**: Works immediately when you scale services
- **Reliability**: Docker DNS handles service discovery automatically
- **Health Checks**: Nginx still provides health checks with `max_fails=3` and `fail_timeout=30s`
- **Connection Pooling**: Keepalive connections (`keepalive 32`) for better performance

## How It Works

1. **Service Scaling**: Docker Compose creates multiple containers when you scale
2. **DNS Resolution**: Docker's internal DNS (127.0.0.11) resolves service names to all instance IPs
3. **Round-Robin**: DNS queries return IPs in round-robin fashion
4. **Nginx Upstream**: Nginx upstream blocks reference the service name, Docker DNS handles distribution
5. **No Reload Needed**: When you scale, Docker DNS updates automatically

## Nginx Configuration

The Nginx configuration uses:
- Service names in upstream blocks (`auth:3001`, `payments:3002`)
- Docker DNS resolver (127.0.0.11) for dynamic resolution
- Health checks with `max_fails=3` and `fail_timeout=30s`
- Keepalive connections (`keepalive 32`) for performance

## Verification

Check running instances:
```bash
docker-compose ps
```

You should see multiple containers for auth and payments services.

Test load balancing:
```bash
# Make multiple requests - they should be distributed across instances
for i in {1..10}; do
  curl -k https://localhost/auth/health
  echo ""
done
```

Check Nginx access logs to see requests being distributed:
```bash
docker-compose exec nginx tail -f /var/log/nginx/opareta-access.log
```

Verify Docker DNS resolution:
```bash
# From within a container, check DNS resolution
docker-compose exec nginx nslookup auth
# You should see multiple IP addresses (one per scaled instance)
```

