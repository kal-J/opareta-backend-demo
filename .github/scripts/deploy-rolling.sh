#!/bin/bash
set -euo pipefail

# Rolling deployment script for zero-downtime updates
# Usage: ./deploy-rolling.sh <service> <health_timeout> <health_interval>
# service: 'auth', 'payments', or 'all'

SERVICE="${1:-all}"
HEALTH_TIMEOUT="${2:-120}"
HEALTH_INTERVAL="${3:-5}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check service health
check_health() {
    local service=$1
    local port=$2
    local endpoint=$3
    
    local max_attempts=$((HEALTH_TIMEOUT / HEALTH_INTERVAL))
    local attempt=0
    
    log_info "Checking health for $service (max ${max_attempts} attempts, ${HEALTH_INTERVAL}s interval)..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "http://localhost:${port}${endpoint}" > /dev/null 2>&1; then
            log_info "$service is healthy!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -lt $max_attempts ]; then
            log_warn "$service health check failed (attempt $attempt/$max_attempts), retrying in ${HEALTH_INTERVAL}s..."
            sleep $HEALTH_INTERVAL
        fi
    done
    
    log_error "$service health check failed after $max_attempts attempts"
    return 1
}

# Function to get current running instances
get_instance_count() {
    local service=$1
    $DOCKER_COMPOSE ps -q "$service" 2>/dev/null | wc -l
}

# Function to perform rolling update for a service
rolling_update_service() {
    local service=$1
    local port=$2
    local health_endpoint=$3
    local target_instances=2
    
    log_info "Starting rolling update for $service..."
    
    # Get current instance count
    local current_instances=$(get_instance_count "$service")
    log_info "Current $service instances: $current_instances"
    
        if [ "$current_instances" -eq 0 ]; then
            log_warn "No running instances of $service. Starting fresh deployment..."
            $DOCKER_COMPOSE up -d --scale "$service=$target_instances" --no-deps --build "$service"
        
        # Wait for all instances to be healthy
        if ! check_health "$service" "$port" "$health_endpoint"; then
            log_error "Failed to start $service instances"
            return 1
        fi
        return 0
    fi
    
    # Rolling update: update one instance at a time
    local instance_to_update=1
    while [ $instance_to_update -le $current_instances ]; do
        log_info "Updating instance $instance_to_update of $service..."
        
        # Scale down to (current - 1) instances (removes oldest instance)
        local scale_down=$((current_instances - 1))
        if [ $scale_down -lt 1 ]; then
            scale_down=1
        fi
        
        log_info "Scaling $service down to $scale_down instances..."
        $DOCKER_COMPOSE up -d --scale "$service=$scale_down" --no-deps "$service"
        
        # Wait a moment for the instance to stop
        sleep 5
        
        # Scale back up and build new instance
        log_info "Scaling $service back up to $current_instances instances with new image..."
        $DOCKER_COMPOSE up -d --scale "$service=$current_instances" --no-deps --build "$service"
        
        # Wait for new instance to be healthy
        log_info "Waiting for new $service instance to be healthy..."
        if ! check_health "$service" "$port" "$health_endpoint"; then
            log_error "New $service instance failed health check. Rolling back..."
            # Rollback: scale back to previous state
            $DOCKER_COMPOSE up -d --scale "$service=$current_instances" --no-deps "$service"
            return 1
        fi
        
        log_info "Instance $instance_to_update of $service updated successfully"
        instance_to_update=$((instance_to_update + 1))
        
        # Small delay between instance updates
        if [ $instance_to_update -le $current_instances ]; then
            sleep 10
        fi
    done
    
    log_info "Rolling update for $service completed successfully!"
    return 0
}

# Main deployment logic
main() {
    log_info "Starting zero-downtime deployment for: $SERVICE"
    log_info "Health check timeout: ${HEALTH_TIMEOUT}s, interval: ${HEALTH_INTERVAL}s"
    
    # Determine docker-compose command (support both docker-compose and docker compose)
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        log_error "docker-compose not found. Please install docker-compose or Docker with compose plugin."
        exit 1
    fi
    
    # Check if services are running
    if ! $DOCKER_COMPOSE ps | grep -q "Up"; then
        log_warn "No services are currently running. Starting all services..."
        $DOCKER_COMPOSE up -d
        sleep 30  # Wait for services to start
    fi
    
    local failed=false
    
    # Deploy services based on input
    case "$SERVICE" in
        auth)
            if ! rolling_update_service "auth" "80" "/auth/health"; then
                failed=true
            fi
            ;;
        payments)
            if ! rolling_update_service "payments" "80" "/payments/health"; then
                failed=true
            fi
            ;;
        all)
            # Update nginx first if needed
            log_info "Updating nginx..."
            $DOCKER_COMPOSE up -d --build nginx
            sleep 5
            
            # Update auth service
            if ! rolling_update_service "auth" "80" "/auth/health"; then
                failed=true
            fi
            
            # Update payments service
            if ! rolling_update_service "payments" "80" "/payments/health"; then
                failed=true
            fi
            ;;
        *)
            log_error "Unknown service: $SERVICE. Use 'auth', 'payments', or 'all'"
            exit 1
            ;;
    esac
    
    if [ "$failed" = true ]; then
        log_error "Deployment failed for one or more services"
        exit 1
    fi
    
    log_info "Deployment completed successfully!"
    
    # Show final status
    log_info "Final service status:"
    $DOCKER_COMPOSE ps
}

main "$@"

