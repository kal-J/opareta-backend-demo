#!/bin/bash

###############################################################################
# PostgreSQL Backup Script for Opareta
# 
# This script backs up all PostgreSQL databases in the Docker Compose setup
# - Backs up auth-db and payments-db
# - Implements 7-day retention policy
# - Creates timestamped backup files
# - Logs all operations
###############################################################################

set -euo pipefail

# Configuration
# Use environment variables if set, otherwise use defaults
BACKUP_DIR="${BACKUP_DIR:-/backups/data}"
LOG_DIR="${LOG_DIR:-/backups/logs}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create directories if they don't exist
mkdir -p "${BACKUP_DIR}"
mkdir -p "${LOG_DIR}"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1" | tee -a "${LOG_FILE}"
}

# Function to backup a single database
backup_database() {
    local container_name=$1
    local db_name=$2
    local db_user=$3
    local db_host="${4:-${container_name}}"
    local db_port="${5:-5432}"
    local backup_file="${BACKUP_DIR}/${container_name}_${db_name}_${TIMESTAMP}.sql.gz"
    
    log_info "Starting backup for ${container_name} (database: ${db_name})"
    
    # Use direct pg_dump connection (we're in the same Docker network)
    log_info "Connecting to database at ${db_host}:${db_port}"
    
    # Get password from environment (set by caller)
    local db_password="${PGPASSWORD:-}"
    if [ -z "${db_password}" ]; then
        log_error "PGPASSWORD not set for ${container_name}"
        return 1
    fi
    
    # Check if database is ready
    if ! PGPASSWORD="${db_password}" pg_isready -h "${db_host}" -p "${db_port}" -U "${db_user}" >/dev/null 2>&1; then
        log_error "Database ${db_host}:${db_port} is not ready!"
        return 1
    fi
    
    # Perform backup using pg_dump
    if PGPASSWORD="${db_password}" pg_dump -h "${db_host}" -p "${db_port}" -U "${db_user}" -d "${db_name}" \
        --no-owner --no-acl --clean --if-exists 2>>"${LOG_FILE}" | gzip > "${backup_file}"; then
        local file_size=$(du -h "${backup_file}" | cut -f1)
        log_success "Backup completed: ${backup_file} (${file_size})"
        return 0
    else
        log_error "Backup failed for ${container_name}"
        rm -f "${backup_file}"
        return 1
    fi
}

# Function to clean old backups (retention policy)
clean_old_backups() {
    log_info "Cleaning backups older than ${RETENTION_DAYS} days..."
    
    local deleted_count=0
    local deleted_size=0
    
    # Find and delete backups older than retention period
    while IFS= read -r backup_file; do
        if [ -f "${backup_file}" ]; then
            local file_size=$(du -b "${backup_file}" | cut -f1)
            deleted_size=$((deleted_size + file_size))
            rm -f "${backup_file}"
            deleted_count=$((deleted_count + 1))
            log_info "Deleted old backup: $(basename "${backup_file}")"
        fi
    done < <(find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime +${RETENTION_DAYS})
    
    if [ ${deleted_count} -gt 0 ]; then
        local deleted_size_mb=$(echo "scale=2; ${deleted_size}/1024/1024" | bc)
        log_success "Cleaned ${deleted_count} old backup(s), freed ${deleted_size_mb} MB"
    else
        log_info "No old backups to clean"
    fi
}

# Function to verify backup integrity
verify_backup() {
    local backup_file=$1
    
    if [ ! -f "${backup_file}" ]; then
        log_error "Backup file not found: ${backup_file}"
        return 1
    fi
    
    # Check if file is a valid gzip archive
    if ! gzip -t "${backup_file}" 2>/dev/null; then
        log_error "Backup file is corrupted: ${backup_file}"
        return 1
    fi
    
    log_success "Backup integrity verified: $(basename "${backup_file}")"
    return 0
}

# Main execution
main() {
    log "=========================================="
    log "PostgreSQL Backup Script Started"
    log "Timestamp: ${TIMESTAMP}"
    log "=========================================="
    
    local backup_failed=0
    local total_backups=0
    local successful_backups=0
    
    # Get database credentials from environment or use defaults
    AUTH_DB_HOST="${AUTH_DB_HOST:-auth-db}"
    AUTH_DB_PORT="${AUTH_DB_PORT:-5432}"
    AUTH_DB_USER="${AUTH_DB_USER:-auth_user}"
    AUTH_DB_NAME="${AUTH_DB_NAME:-auth_db}"
    AUTH_DB_PASSWORD="${AUTH_DB_PASSWORD:-auth_password}"
    
    PAYMENTS_DB_HOST="${PAYMENTS_DB_HOST:-payments-db}"
    PAYMENTS_DB_PORT="${PAYMENTS_DB_PORT:-5432}"
    PAYMENTS_DB_USER="${PAYMENTS_DB_USER:-payments_user}"
    PAYMENTS_DB_NAME="${PAYMENTS_DB_NAME:-payments_db}"
    PAYMENTS_DB_PASSWORD="${PAYMENTS_DB_PASSWORD:-payments_password}"
    
    # Backup auth-db
    export PGPASSWORD="${AUTH_DB_PASSWORD}"
    if backup_database "auth-db" "${AUTH_DB_NAME}" "${AUTH_DB_USER}" "${AUTH_DB_HOST}" "${AUTH_DB_PORT}"; then
        successful_backups=$((successful_backups + 1))
    else
        backup_failed=1
    fi
    total_backups=$((total_backups + 1))
    unset PGPASSWORD
    
    # Backup payments-db
    export PGPASSWORD="${PAYMENTS_DB_PASSWORD}"
    if backup_database "payments-db" "${PAYMENTS_DB_NAME}" "${PAYMENTS_DB_USER}" "${PAYMENTS_DB_HOST}" "${PAYMENTS_DB_PORT}"; then
        successful_backups=$((successful_backups + 1))
    else
        backup_failed=1
    fi
    total_backups=$((total_backups + 1))
    unset PGPASSWORD
    
    # Verify backups
    log_info "Verifying backups..."
    for backup_file in "${BACKUP_DIR}"/*_${TIMESTAMP}.sql.gz; do
        if [ -f "${backup_file}" ]; then
            verify_backup "${backup_file}"
        fi
    done
    
    # Clean old backups
    clean_old_backups
    
    # Summary
    log "=========================================="
    log "Backup Summary:"
    log "  Total databases: ${total_backups}"
    log "  Successful: ${successful_backups}"
    log "  Failed: $((total_backups - successful_backups))"
    log "=========================================="
    
    # List current backups
    log_info "Current backups (last 7 days):"
    find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime -${RETENTION_DAYS} -exec ls -lh {} \; | \
        awk '{print "  " $9 " (" $5 ")"}' | tee -a "${LOG_FILE}"
    
    if [ ${backup_failed} -eq 0 ]; then
        log_success "All backups completed successfully!"
        exit 0
    else
        log_error "Some backups failed. Check logs for details."
        exit 1
    fi
}

# Run main function
main "$@"

