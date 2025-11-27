#!/bin/bash

###############################################################################
# List PostgreSQL Backups
# 
# Lists all available backups with details
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"

if [ ! -d "${BACKUP_DIR}" ]; then
    echo "No backups directory found."
    exit 1
fi

echo "=========================================="
echo "Available PostgreSQL Backups"
echo "=========================================="
echo ""

# List backups with details
if [ -n "$(find "${BACKUP_DIR}" -name "*.sql.gz" -type f)" ]; then
    printf "%-50s %10s %20s\n" "Backup File" "Size" "Date"
    echo "------------------------------------------------------------"
    
    find "${BACKUP_DIR}" -name "*.sql.gz" -type f -exec ls -lh {} \; | \
        awk '{printf "%-50s %10s %20s\n", $9, $5, $6" "$7" "$8}' | \
        sort -k3 -r
    
    echo ""
    echo "Total backups: $(find "${BACKUP_DIR}" -name "*.sql.gz" -type f | wc -l)"
    
    # Show backups by database
    echo ""
    echo "Backups by database:"
    echo "  Auth DB:    $(find "${BACKUP_DIR}" -name "auth-db_*.sql.gz" -type f | wc -l) file(s)"
    echo "  Payments DB: $(find "${BACKUP_DIR}" -name "payments-db_*.sql.gz" -type f | wc -l) file(s)"
    
    # Show retention status
    echo ""
    echo "Retention status (last 7 days):"
    echo "  Within retention: $(find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime -7 | wc -l) file(s)"
    echo "  Older than 7 days: $(find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime +7 | wc -l) file(s)"
else
    echo "No backups found."
fi

echo "=========================================="

