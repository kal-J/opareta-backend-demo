# Monitoring Setup

Complete monitoring solution for Opareta using Prometheus, Node Exporter, and Grafana.

## Overview

This monitoring setup provides:
- **Metrics Collection**: Prometheus scrapes metrics from all services
- **System Metrics**: Node Exporter provides CPU, memory, disk metrics
- **Visualization**: Grafana dashboards for comprehensive monitoring
- **Alerting**: Prometheus alert rules for critical issues

## Services

### Prometheus
- **Port**: 9090
- **URL**: http://localhost:9090
- **Purpose**: Metrics collection and storage
- **Retention**: 200 hours (~8 days)

### Grafana
- **Port**: 3000
- **URL**: http://localhost:3000
- **Default Credentials**: 
  - Username: `admin`
  - Password: `admin` (change via `GRAFANA_PASSWORD` env var)
- **Purpose**: Visualization and dashboards

### Node Exporter
- **Port**: 9100 (internal)
- **Purpose**: System metrics (CPU, memory, disk, network)

### PostgreSQL Exporters
- **Auth DB Exporter**: `postgres-exporter-auth` (port 9187, internal)
- **Payments DB Exporter**: `postgres-exporter-payments` (port 9187, internal)
- **Purpose**: Database connection and performance metrics for both databases

### Redis Exporter
- **Port**: 9121 (internal)
- **Purpose**: Redis queue depth and memory metrics

### Nginx Exporter
- **Port**: 9113 (internal)
- **Purpose**: Nginx request rate and status metrics

## Quick Start

### Start All Monitoring Services

```bash
docker-compose up -d prometheus grafana node-exporter postgres-exporter-auth postgres-exporter-payments redis-exporter nginx-exporter
```

### Access Dashboards

1. **Grafana**: http://localhost:3000
   - Login with admin/admin
   - Dashboard: "Opareta - System Overview" (auto-loaded)

2. **Prometheus**: http://localhost:9090
   - Query metrics
   - View targets
   - Check alerts

## Dashboard Panels

The "Opareta - System Overview" dashboard includes:

1. **Service Health Status** - Up/Down status for auth and payments services
2. **Request Rate** - Requests per second by HTTP status code
3. **Request Latency** - p50 and p95 latency for both services
4. **Payment Success Rate** - Percentage of successful payments
5. **Payment Success/Failure Rate** - Detailed breakdown of payment outcomes
6. **CPU Usage** - System CPU utilization
7. **Memory Usage** - System memory consumption
8. **Disk Usage** - Available and used disk space
9. **Database Connections** - Active connections per database
10. **Redis Queue Depth** - Queue length and connected clients
11. **Error Rate** - Overall error rate across services

## Alert Rules

Prometheus alert rules are configured in `monitoring/alerts/alerts.yml`:

### Service Health Alerts
- **ServiceDown**: Service is down for >1 minute
- **ServiceHealthCheckFailed**: Service returning non-2xx responses

### Error Rate Alerts
- **HighErrorRate**: Error rate >5% for 5 minutes
- **HighPaymentFailureRate**: Payment failures >5% for 5 minutes

### System Resource Alerts
- **LowDiskSpace**: Disk space <20% available
- **HighCPUUsage**: CPU usage >80% for 5 minutes
- **HighMemoryUsage**: Memory usage >90% for 5 minutes

### Database Alerts
- **HighDatabaseConnections**: >80 active connections
- **DatabaseDown**: Database exporter not responding

### Redis Alerts
- **RedisDown**: Redis exporter not responding
- **HighRedisQueueDepth**: Queue depth >1000
- **HighRedisMemoryUsage**: Memory usage >90%

### Performance Alerts
- **HighRequestLatency**: p95 latency >1.0s for 5 minutes
- **LowRequestRate**: Request rate <0.1 req/s for 10 minutes

## Configuration Files

### Prometheus Configuration
- **File**: `monitoring/prometheus.yml`
- **Alert Rules**: `monitoring/alerts/alerts.yml`

### Grafana Configuration
- **Datasource**: `monitoring/grafana/provisioning/datasources/prometheus.yml`
- **Dashboard Provisioning**: `monitoring/grafana/provisioning/dashboards/dashboards.yml`
- **Dashboard JSON**: `monitoring/grafana/dashboards/opareta-overview.json`

## Metrics Endpoints

All services expose metrics at `/metrics`:
- **Auth Service**: `http://auth:3001/metrics`
- **Payments Service**: `http://payments:3002/metrics`

## Nginx Status Endpoint

Nginx exposes status at `/nginx_status` (internal only):
- **URL**: `http://nginx:80/nginx_status`
- **Access**: Restricted to internal network

## Customization

### Change Grafana Password

Set environment variable in `docker-compose.yml`:
```yaml
environment:
  - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
```

### Modify Alert Thresholds

Edit `monitoring/alerts/alerts.yml` and restart Prometheus:
```bash
docker-compose restart prometheus
```

### Add Custom Dashboards

1. Create dashboard JSON in `monitoring/grafana/dashboards/`
2. Restart Grafana or reload provisioning
3. Dashboard will appear automatically

## Troubleshooting

### Prometheus Not Scraping

Check targets: http://localhost:9090/targets

Common issues:
- Services not running
- Network connectivity issues
- Incorrect service names in prometheus.yml

### Grafana No Data

1. Check datasource connection: Configuration → Data Sources → Prometheus → Test
2. Verify Prometheus is accessible: `docker-compose exec grafana wget -O- http://prometheus:9090/api/v1/query?query=up`
3. Check dashboard queries match available metrics

### Missing Metrics

Ensure services have metrics endpoints:
```bash
curl http://localhost:3001/metrics  # Auth
curl http://localhost:3002/metrics  # Payments
```

## Best Practices

1. **Regular Review**: Check dashboards daily
2. **Alert Tuning**: Adjust thresholds based on actual usage
3. **Retention**: Monitor Prometheus storage usage
4. **Backup**: Export Grafana dashboards regularly
5. **Documentation**: Document custom alerts and dashboards

## Support

For issues:
1. Check service logs: `docker-compose logs <service>`
2. Verify network connectivity: `docker-compose exec <service> ping <target>`
3. Test metrics endpoints directly
4. Review Prometheus targets page

