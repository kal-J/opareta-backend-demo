#!/bin/bash

###############################################################################
# PostgreSQL Restore Script for Opareta
# 
# This script restores PostgreSQL databases from backup files
# Usage: ./restore-postgres.sh <backup-file> <container-name> <database-name> <database-user>
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 <backup-file> <container-name> <database-name> <database-user> [--confirm]

Arguments:
  backup-file      Path to the backup file (.sql.gz)
  container-name   Docker container name (e.g., auth-db, payments-db)
  database-name    Database name to restore (e.g., auth_db, payments_db)
  database-user    Database user (e.g., auth_user, payments_user)
  --confirm        Skip confirmation prompt (use with caution!)

Examples:
  # Restore auth-db
  $0 backups/auth-db_auth_db_20250101_120000.sql.gz auth-db auth_db auth_user

  # Restore payments-db
  $0 backups/payments-db_payments_db_20250101_120000.sql.gz payments-db payments_db payments_user

WARNING: This will DROP and RECREATE the database. All current data will be lost!
EOF
    exit 1
}

# Function to verify backup file
verify_backup_file() {
    local backup_file=$1
    
    if [ ! -f "${backup_file}" ]; then
        log_error "Backup file not found: ${backup_file}"
        return 1
    fi
    
    if ! gzip -t "${backup_file}" 2>/dev/null; then
        log_error "Backup file is corrupted or not a valid gzip archive: ${backup_file}"
        return 1
    fi
    
    log_success "Backup file verified: ${backup_file}"
    return 0
}

# Function to check if container is running
check_container() {
    local container_name=$1
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_error "Container ${container_name} is not running!"
        log_info "Start the container with: docker-compose up -d ${container_name}"
        return 1
    fi
    
    log_success "Container ${container_name} is running"
    return 0
}

# Function to restore database
restore_database() {
    local backup_file=$1
    local container_name=$2
    local db_name=$3
    local db_user=$4
    
    log_info "=========================================="
    log_info "Starting database restore"
    log_info "  Container: ${container_name}"
    log_info "  Database: ${db_name}"
    log_info "  User: ${db_user}"
    log_info "  Backup: $(basename "${backup_file}")"
    log_info "=========================================="
    
    # Verify backup file
    if ! verify_backup_file "${backup_file}"; then
        return 1
    fi
    
    # Check container
    if ! check_container "${container_name}"; then
        return 1
    fi
    
    log_info "Restoring database..."
    
    # Restore the database
    # Note: The backup was created with --clean --if-exists, so it will drop objects
    if gunzip -c "${backup_file}" | docker exec -i "${container_name}" psql -U "${db_user}" -d "${db_name}" 2>&1; then
        log_success "Database restore completed successfully!"
        return 0
    else
        log_error "Database restore failed!"
        return 1
    fi
}

# Main execution
main() {
    # Check arguments
    if [ $# -lt 4 ]; then
        show_usage
    fi
    
    local backup_file=$1
    local container_name=$2
    local db_name=$3
    local db_user=$4
    local confirm_flag=${5:-}
    
    # Convert relative path to absolute if needed
    if [[ ! "${backup_file}" = /* ]]; then
        local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        backup_file="${script_dir}/${backup_file}"
    fi
    
    # Confirmation prompt
    if [ "${confirm_flag}" != "--confirm" ]; then
        echo ""
        log_error "WARNING: This operation will DROP and RECREATE the database!"
        log_error "All current data in ${db_name} will be PERMANENTLY DELETED!"
        echo ""
        read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
        if [ "${confirmation}" != "yes" ]; then
            log_info "Restore cancelled."
            exit 0
        fi
    fi
    
    # Perform restore
    if restore_database "${backup_file}" "${container_name}" "${db_name}" "${db_user}"; then
        log_success "=========================================="
        log_success "Restore completed successfully!"
        log_success "=========================================="
        exit 0
    else
        log_error "=========================================="
        log_error "Restore failed!"
        log_error "=========================================="
        exit 1
    fi
}

# Run main function
main "$@"

