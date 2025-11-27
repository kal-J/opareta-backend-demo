#!/bin/bash
set -euo pipefail

# Deployment validation script
# Usage: ./validate-deployment.sh <service>
# service: 'auth', 'payments', or 'all'

SERVICE="${1:-all}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to validate service health
validate_service_health() {
    local service=$1
    local port=$2
    local health_endpoint=$3
    local service_name=$4
    
    log_info "Validating $service_name health..."
    
    # Check through nginx
    if ! curl -f -s "http://localhost:${port}${health_endpoint}" > /dev/null 2>&1; then
        log_error "$service_name health check failed via nginx"
        return 1
    fi
    
    # Check service directly (if accessible)
    local direct_port
    case "$service" in
        auth)
            direct_port=3001
            ;;
        payments)
            direct_port=3002
            ;;
        *)
            return 0
            ;;
    esac
    
    # Try to check direct service health (may not be accessible from host)
    log_info "$service_name health check passed via nginx"
    return 0
}

# Determine docker-compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    log_error "docker-compose not found"
    exit 1
fi

# Function to check service instances
validate_service_instances() {
    local service=$1
    local expected_min=1
    
    local instance_count=$($DOCKER_COMPOSE ps -q "$service" 2>/dev/null | wc -l)
    
    if [ "$instance_count" -lt "$expected_min" ]; then
        log_error "$service has only $instance_count instances (expected at least $expected_min)"
        return 1
    fi
    
    log_info "$service has $instance_count running instances"
    return 0
}

# Function to perform basic functionality test
test_service_functionality() {
    local service=$1
    local test_endpoint=$2
    local service_name=$3
    
    log_info "Testing $service_name functionality..."
    
    # Simple connectivity test
    if ! curl -f -s "http://localhost:80${test_endpoint}" > /dev/null 2>&1; then
        log_error "$service_name functionality test failed"
        return 1
    fi
    
    log_info "$service_name functionality test passed"
    return 0
}

# Main validation logic
main() {
    log_info "Starting deployment validation for: $SERVICE"
    
    local failed=false
    
    case "$SERVICE" in
        auth)
            if ! validate_service_instances "auth"; then
                failed=true
            fi
            if ! validate_service_health "auth" "80" "/auth/health" "Auth Service"; then
                failed=true
            fi
            if ! test_service_functionality "auth" "/auth/health" "Auth Service"; then
                failed=true
            fi
            ;;
        payments)
            if ! validate_service_instances "payments"; then
                failed=true
            fi
            if ! validate_service_health "payments" "80" "/payments/health" "Payments Service"; then
                failed=true
            fi
            if ! test_service_functionality "payments" "/payments/health" "Payments Service"; then
                failed=true
            fi
            ;;
        all)
            # Validate nginx
            log_info "Validating nginx..."
            if ! curl -f -s "http://localhost:80/nginx-health" > /dev/null 2>&1; then
                log_error "Nginx health check failed"
                failed=true
            fi
            
            # Validate auth service
            if ! validate_service_instances "auth"; then
                failed=true
            fi
            if ! validate_service_health "auth" "80" "/auth/health" "Auth Service"; then
                failed=true
            fi
            if ! test_service_functionality "auth" "/auth/health" "Auth Service"; then
                failed=true
            fi
            
            # Validate payments service
            if ! validate_service_instances "payments"; then
                failed=true
            fi
            if ! validate_service_health "payments" "80" "/payments/health" "Payments Service"; then
                failed=true
            fi
            if ! test_service_functionality "payments" "/payments/health" "Payments Service"; then
                failed=true
            fi
            ;;
        *)
            log_error "Unknown service: $SERVICE. Use 'auth', 'payments', or 'all'"
            exit 1
            ;;
    esac
    
    if [ "$failed" = true ]; then
        log_error "Deployment validation failed"
        exit 1
    fi
    
    log_info "Deployment validation passed!"
    
    # Show service status
    log_info "Service status:"
    $DOCKER_COMPOSE ps
}

main "$@"

