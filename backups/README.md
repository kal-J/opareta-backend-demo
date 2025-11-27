# PostgreSQL Backup Automation (Docker Service)

This directory contains a Docker-based automated backup service for PostgreSQL databases in the Opareta system.

**The backup system runs as a Docker service** that automatically backs up databases daily at 2:00 AM.

## Overview

The backup system provides:
- **Automated daily backups** of all PostgreSQL databases
- **7-day retention policy** (automatically removes backups older than 7 days)
- **Backup integrity verification** (checks if backups are valid)
- **Comprehensive logging** of all backup operations
- **Easy restore procedure** with step-by-step commands

## Databases Backed Up

1. **auth-db** (container: `auth-db`, database: `auth_db`, user: `auth_user`)
2. **payments-db** (container: `payments-db`, database: `payments_db`, user: `payments_user`)

## Directory Structure

```
backups/
├── data/              # Backup files stored here (.sql.gz)
├── logs/                 # Backup logs
├── backup-postgres.sh    # Main backup script
├── restore-postgres.sh   # Restore script
├── list-backups.sh       # List available backups
├── cron.daily-backup     # Cron job configuration
└── README.md             # This file
```

## Quick Start

### Start Backup Service

The backup service is automatically started with docker-compose:

```bash
docker-compose up -d db-backups
```

### Manual Backup

Run a backup manually:

```bash
# From the backup container
docker exec db-backups /usr/local/bin/backup-postgres.sh

# Or from host (if scripts are available)
cd backups
./backup-postgres.sh
```

### List Backups

View all available backups:

```bash
./list-backups.sh
```

### Restore Database

Restore from a backup:

```bash
./restore-postgres.sh backups/auth-db_auth_db_20250101_120000.sql.gz auth-db auth_db auth_user
```

## Scheduling Backups

### Automatic Scheduling (Docker Service)

The backup service runs automatically as a Docker container with cron scheduling:

```bash
# Start the backup service
docker-compose up -d db-backups

# Check service status
docker-compose ps db-backups

# View logs
docker-compose logs -f db-backups
```

**Backup Schedule**: Daily at 2:00 AM (configured in `crontab` file)

### Manual Backup Execution

You can trigger a backup manually at any time:

```bash
# Run backup from container
docker exec db-backups /usr/local/bin/backup-postgres.sh

# Check backup logs
docker exec db-backups tail -f /backups/logs/cron.log
```

## Backup Details

### Backup Format

Backups are created as compressed SQL dumps:
- Format: `{container-name}_{database-name}_{timestamp}.sql.gz`
- Example: `auth-db_auth_db_20250101_120000.sql.gz`

### Backup Contents

Each backup includes:
- Complete database schema
- All data
- Clean statements (drops objects before recreating)
- No owner/ACL information (for portability)

### Retention Policy

- **Retention Period**: 7 days
- **Automatic Cleanup**: Old backups are automatically deleted during each backup run
- **Manual Cleanup**: You can manually delete backups if needed

### Backup Location

Backups are stored in: `backups/data/`

Logs are stored in: `backups/logs/`

## Restore Procedure

### Step 1: List Available Backups

```bash
cd backups
./list-backups.sh
```

### Step 2: Choose a Backup File

Identify the backup file you want to restore from. Example:
- `backups/auth-db_auth_db_20250101_120000.sql.gz`
- `backups/payments-db_payments_db_20250101_120000.sql.gz`

### Step 3: Ensure Container is Running

```bash
# Check if container is running
docker ps | grep auth-db
docker ps | grep payments-db

# Start container if not running
docker-compose up -d auth-db
docker-compose up -d payments-db
```

### Step 4: Restore Database

#### Restore auth-db:

```bash
./restore-postgres.sh \
  backups/auth-db_auth_db_20250101_120000.sql.gz \
  auth-db \
  auth_db \
  auth_user
```

#### Restore payments-db:

```bash
./restore-postgres.sh \
  backups/payments-db_payments_db_20250101_120000.sql.gz \
  payments-db \
  payments_db \
  payments_user
```

### Step 5: Verify Restore

```bash
# Connect to database and verify data
docker exec -it auth-db psql -U auth_user -d auth_db -c "SELECT COUNT(*) FROM users;"
docker exec -it payments-db psql -U payments_user -d payments_db -c "SELECT COUNT(*) FROM payments;"
```

## Testing Backup/Restore

### Test Backup

```bash
# Run backup
./backup-postgres.sh

# Verify backup was created
ls -lh data/

# Check backup integrity
gzip -t data/auth-db_auth_db_*.sql.gz
gzip -t data/payments-db_payments_db_*.sql.gz
```

### Test Restore

**⚠️ WARNING: This will delete current data!**

```bash
# 1. Create a test backup first
./backup-postgres.sh

# 2. Note the current data (optional)
docker exec -it auth-db psql -U auth_user -d auth_db -c "SELECT COUNT(*) FROM users;"

# 3. Restore from backup
./restore-postgres.sh data/auth-db_auth_db_YYYYMMDD_HHMMSS.sql.gz auth-db auth_db auth_user

# 4. Verify data was restored
docker exec -it auth-db psql -U auth_user -d auth_db -c "SELECT COUNT(*) FROM users;"
```

## Monitoring

### Check Backup Logs

```bash
# View latest log
ls -lt backups/logs/ | head -5
tail -f backups/logs/backup_*.log

# View all logs
cat backups/logs/backup_*.log

# View cron logs from container
docker exec db-backups tail -f /backups/logs/cron.log

# View container logs
docker-compose logs -f db-backups
```

## Troubleshooting

### Backup Fails: Container Not Running

**Error**: `Container auth-db is not running!`

**Solution**:
```bash
docker-compose up -d auth-db
docker-compose up -d payments-db
```

### Backup Fails: Permission Denied

**Error**: `Permission denied`

**Solution**:
```bash
chmod +x backups/*.sh
```

### Restore Fails: Backup File Not Found

**Error**: `Backup file not found`

**Solution**: Use absolute path or relative path from backups directory:
```bash
./restore-postgres.sh data/auth-db_auth_db_20250101_120000.sql.gz auth-db auth_db auth_user
```

### Restore Fails: Database Connection Error

**Error**: `Connection refused` or `database does not exist`

**Solution**:
```bash
# Ensure container is running
docker-compose up -d auth-db

# Check database exists
docker exec -it auth-db psql -U auth_user -l
```

## Backup Script Options

### Environment Variables

You can customize the backup behavior:

```bash
# Change backup directory
export BACKUP_DIR="/custom/path/backups"

# Change retention days
export RETENTION_DAYS=14

# Run backup
./backup-postgres.sh
```

### Manual Retention Cleanup

Clean old backups manually:

```bash
# Remove backups older than 7 days
find backups/data/ -name "*.sql.gz" -type f -mtime +7 -delete

# Remove backups older than 30 days
find backups/data/ -name "*.sql.gz" -type f -mtime +30 -delete
```

## Best Practices

1. **Test Restores Regularly**: Periodically test restore procedures to ensure backups are valid
2. **Monitor Backup Logs**: Check logs regularly to ensure backups are completing successfully
3. **Offsite Backups**: Consider copying backups to remote storage (S3, NFS, etc.)
4. **Backup Before Updates**: Always backup before major database migrations or updates
5. **Verify Backups**: Use `gzip -t` to verify backup integrity
6. **Document Restore Procedures**: Keep restore procedures documented and tested

## Security Considerations

- Backup files contain sensitive data - protect them appropriately
- Use appropriate file permissions: `chmod 600 backups/data/*.sql.gz`
- Consider encrypting backups for sensitive data
- Store backups in secure locations
- Rotate backup storage locations

## Support

For issues or questions:
1. Check logs in `backups/logs/`
2. Verify containers are running: `docker-compose ps`
3. Test backup manually: `./backup-postgres.sh`
4. Review this documentation

