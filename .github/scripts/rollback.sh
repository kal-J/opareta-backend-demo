#!/bin/bash
set -euo pipefail

# Rollback script for failed deployments
# Usage: ./rollback.sh <service> <max_attempts>
# service: 'auth', 'payments', or 'all'

SERVICE="${1:-all}"
MAX_ATTEMPTS="${2:-3}"

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

# Determine docker-compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    log_error "docker-compose not found"
    exit 1
fi

# Function to rollback service
rollback_service() {
    local service=$1
    local attempt=1
    
    log_info "Attempting to rollback $service..."
    
    while [ $attempt -le $MAX_ATTEMPTS ]; do
        log_info "Rollback attempt $attempt/$MAX_ATTEMPTS for $service..."
        
        # Get current instance count
        local current_instances=$($DOCKER_COMPOSE ps -q "$service" 2>/dev/null | wc -l)
        
        if [ "$current_instances" -eq 0 ]; then
            log_warn "No running instances of $service. Cannot rollback."
            return 1
        fi
        
        # Stop and remove all instances
        log_info "Stopping all $service instances..."
        $DOCKER_COMPOSE stop "$service" || true
        $DOCKER_COMPOSE rm -f "$service" || true
        
        # Pull previous image or rebuild from previous commit
        if [ -f .deployment/commit_sha ]; then
            local previous_commit=$(cat .deployment/commit_sha)
            log_info "Rolling back to commit: $previous_commit"
            
            # Checkout previous commit temporarily to rebuild
            git stash || true
            git checkout "$previous_commit" || {
                log_warn "Could not checkout previous commit. Using current code..."
                git stash pop || true
            }
        fi
        
        # Rebuild and start service
        log_info "Rebuilding and starting $service..."
        $DOCKER_COMPOSE up -d --build --scale "$service=$current_instances" "$service"
        
        # Wait for services to start
        sleep 20
        
        # Check health
        local health_endpoint
        case "$service" in
            auth)
                health_endpoint="/auth/health"
                ;;
            payments)
                health_endpoint="/payments/health"
                ;;
            *)
                log_warn "Unknown service for health check: $service"
                return 0
                ;;
        esac
        
        if curl -f -s "http://localhost:80${health_endpoint}" > /dev/null 2>&1; then
            log_info "$service rollback successful!"
            
            # Restore to current commit if we checked out previous one
            if [ -f .deployment/commit_sha ]; then
                git checkout - || true
                git stash pop || true
            fi
            
            return 0
        else
            log_warn "$service health check failed after rollback attempt $attempt"
            attempt=$((attempt + 1))
            
            # Restore to current commit before next attempt
            if [ -f .deployment/commit_sha ]; then
                git checkout - || true
                git stash pop || true
            fi
        fi
    done
    
    log_error "Rollback failed for $service after $MAX_ATTEMPTS attempts"
    return 1
}

# Function to rollback to previous docker-compose state
rollback_simple() {
    local service=$1
    
    log_info "Performing simple rollback for $service..."
    
    # Get current instance count
    local current_instances=$($DOCKER_COMPOSE ps -q "$service" 2>/dev/null | wc -l)
    
    if [ "$current_instances" -eq 0 ]; then
        log_warn "No running instances of $service. Starting with default scale..."
        current_instances=2
    fi
    
    # Stop and remove instances
    $DOCKER_COMPOSE stop "$service" || true
    $DOCKER_COMPOSE rm -f "$service" || true
    
    # Restart without build (uses existing images)
    log_info "Restarting $service without rebuild..."
    $DOCKER_COMPOSE up -d --no-build --scale "$service=$current_instances" "$service"
    
    # Wait and check health
    sleep 20
    
    local health_endpoint
    case "$service" in
        auth)
            health_endpoint="/auth/health"
            ;;
        payments)
            health_endpoint="/payments/health"
            ;;
        *)
            return 0
            ;;
    esac
    
    if curl -f -s "http://localhost:80${health_endpoint}" > /dev/null 2>&1; then
        log_info "$service simple rollback successful!"
        return 0
    else
        log_error "$service simple rollback failed"
        return 1
    fi
}

# Main rollback logic
main() {
    log_info "Starting rollback for: $SERVICE"
    
    local failed=false
    
    case "$SERVICE" in
        auth)
            if ! rollback_simple "auth"; then
                log_warn "Simple rollback failed, trying full rollback..."
                if ! rollback_service "auth"; then
                    failed=true
                fi
            fi
            ;;
        payments)
            if ! rollback_simple "payments"; then
                log_warn "Simple rollback failed, trying full rollback..."
                if ! rollback_service "payments"; then
                    failed=true
                fi
            fi
            ;;
        all)
            # Rollback nginx first
            log_info "Rolling back nginx..."
            $DOCKER_COMPOSE up -d --no-build nginx || true
            
            # Rollback auth
            if ! rollback_simple "auth"; then
                log_warn "Simple rollback failed for auth, trying full rollback..."
                if ! rollback_service "auth"; then
                    failed=true
                fi
            fi
            
            # Rollback payments
            if ! rollback_simple "payments"; then
                log_warn "Simple rollback failed for payments, trying full rollback..."
                if ! rollback_service "payments"; then
                    failed=true
                fi
            fi
            ;;
        *)
            log_error "Unknown service: $SERVICE. Use 'auth', 'payments', or 'all'"
            exit 1
            ;;
    esac
    
    if [ "$failed" = true ]; then
        log_error "Rollback failed for one or more services"
        log_error "Manual intervention may be required. Check service logs:"
        echo "  docker-compose logs $SERVICE"
        exit 1
    fi
    
    log_info "Rollback completed!"
    
    # Show service status
    log_info "Service status after rollback:"
    $DOCKER_COMPOSE ps
}

main "$@"

