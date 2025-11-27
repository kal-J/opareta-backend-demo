# PostgreSQL Restore Guide

This guide provides step-by-step instructions for restoring PostgreSQL databases from backups.

## Prerequisites

- Docker and Docker Compose installed and running
- Backup file available (`.sql.gz` format)
- Appropriate permissions to execute restore script

## Quick Restore

### Step 1: List Available Backups

```bash
cd ./opareta/backups
./list-backups.sh
```

This will show all available backups with their sizes and dates.

### Step 2: Identify the Backup File

Choose the backup file you want to restore. Example:
```
backups/auth-db_auth_db_20250101_120000.sql.gz
backups/payments-db_payments_db_20250101_120000.sql.gz
```

### Step 3: Ensure Services are Running

```bash
# Navigate to project root
cd ./opareta

# Start database containers
docker-compose up -d auth-db
docker-compose up -d payments-db

# Verify they're running
docker-compose ps
```

### Step 4: Run Restore Script

#### Restore Auth Database

```bash
cd ./opareta/backups

./restore-postgres.sh \
  backups/auth-db_auth_db_20250101_120000.sql.gz \
  auth-db \
  auth_db \
  auth_user
```

#### Restore Payments Database

```bash
cd ./opareta/backups

./restore-postgres.sh \
  backups/payments-db_payments_db_20250101_120000.sql.gz \
  payments-db \
  payments_db \
  payments_user
```

### Step 5: Confirm Restore

When prompted, type `yes` to confirm the restore operation.

**⚠️ WARNING**: This will DELETE all current data in the database!

### Step 6: Verify Restore

#### Verify Auth Database

```bash
# Connect to database
docker exec -it auth-db psql -U auth_user -d auth_db

# Check tables
\dt

# Check user count
SELECT COUNT(*) FROM users;

# Exit
\q
```

#### Verify Payments Database

```bash
# Connect to database
docker exec -it payments-db psql -U payments_user -d payments_db

# Check tables
\dt

# Check payment count
SELECT COUNT(*) FROM payments;

# Exit
\q
```

## Detailed Restore Procedure

### Scenario 1: Restore After Data Loss

**Situation**: Data was accidentally deleted or corrupted.

**Steps**:

1. **Stop the application services** (optional, recommended):
   ```bash
   docker-compose stop auth payments
   ```

2. **Identify the latest backup**:
   ```bash
   cd ./opareta/backups
   ./list-backups.sh
   ls -lt backups/ | grep auth-db
   ```

3. **Restore the database**:
   ```bash
   ./restore-postgres.sh \
     backups/auth-db_auth_db_20250101_120000.sql.gz \
     auth-db \
     auth_db \
     auth_user
   ```

4. **Verify the restore**:
   ```bash
   docker exec -it auth-db psql -U auth_user -d auth_db -c "SELECT COUNT(*) FROM users;"
   ```

5. **Restart application services**:
   ```bash
   docker-compose start auth payments
   ```

### Scenario 2: Restore to a Specific Point in Time

**Situation**: Need to restore to a specific backup from a specific date.

**Steps**:

1. **List backups with dates**:
   ```bash
   cd ./opareta/backups
   ls -lht backups/ | grep "2025-01-"
   ```

2. **Choose the backup from the desired date**:
   ```bash
   # Example: Restore from January 15, 2025
   ./restore-postgres.sh \
     backups/auth-db_auth_db_20250115_020000.sql.gz \
     auth-db \
     auth_db \
     auth_user
   ```

3. **Verify the data matches expected state**:
   ```bash
   docker exec -it auth-db psql -U auth_user -d auth_db -c "SELECT * FROM users ORDER BY created_at DESC LIMIT 5;"
   ```

### Scenario 3: Restore Both Databases

**Situation**: Need to restore both auth and payments databases.

**Steps**:

1. **Create a backup of current state** (safety measure):
   ```bash
   cd ./opareta/backups
   ./backup-postgres.sh
   ```

2. **Restore auth database**:
   ```bash
   ./restore-postgres.sh \
     backups/auth-db_auth_db_20250101_120000.sql.gz \
     auth-db \
     auth_db \
     auth_user
   ```

3. **Restore payments database**:
   ```bash
   ./restore-postgres.sh \
     backups/payments-db_payments_db_20250101_120000.sql.gz \
     payments-db \
     payments_db \
     payments_user
   ```

4. **Verify both databases**:
   ```bash
   docker exec -it auth-db psql -U auth_user -d auth_db -c "SELECT COUNT(*) FROM users;"
   docker exec -it payments-db psql -U payments_user -d payments_db -c "SELECT COUNT(*) FROM payments;"
   ```

### Scenario 4: Restore to a New Environment

**Situation**: Setting up a new environment from a backup.

**Steps**:

1. **Start the database containers**:
   ```bash
   cd ./opareta
   docker-compose up -d auth-db payments-db
   ```

2. **Wait for databases to be ready**:
   ```bash
   # Check health
   docker-compose ps
   # Wait until health checks pass
   ```

3. **Copy backup file to new environment** (if needed):
   ```bash
   scp backups/auth-db_auth_db_20250101_120000.sql.gz user@new-server:/path/to/backups/
   ```

4. **Restore the database**:
   ```bash
   cd /path/to/backups
   ./restore-postgres.sh \
     backups/auth-db_auth_db_20250101_120000.sql.gz \
     auth-db \
     auth_db \
     auth_user
   ```

## Manual Restore (Without Script)

If you need to restore manually:

### Step 1: Extract and Restore

```bash
# Extract backup
gunzip -c backups/auth-db_auth_db_20250101_120000.sql.gz > /tmp/restore.sql

# Restore to database
docker exec -i auth-db psql -U auth_user -d auth_db < /tmp/restore.sql

# Clean up
rm /tmp/restore.sql
```

### Step 2: Verify

```bash
docker exec -it auth-db psql -U auth_user -d auth_db -c "\dt"
```

## Troubleshooting

### Error: Container Not Running

**Problem**: `Container auth-db is not running!`

**Solution**:
```bash
docker-compose up -d auth-db
# Wait for health check to pass
docker-compose ps
```

### Error: Backup File Not Found

**Problem**: `Backup file not found`

**Solution**: Use absolute path or ensure you're in the backups directory:
```bash
cd ./opareta/backups
./restore-postgres.sh backups/auth-db_auth_db_20250101_120000.sql.gz auth-db auth_db auth_user
```

### Error: Permission Denied

**Problem**: `Permission denied`

**Solution**:
```bash
chmod +x restore-postgres.sh
```

### Error: Database Connection Failed

**Problem**: `Connection refused` or `database does not exist`

**Solution**:
```bash
# Check container is running
docker ps | grep auth-db

# Check database exists
docker exec -it auth-db psql -U auth_user -l

# If database doesn't exist, create it
docker exec -it auth-db psql -U auth_user -c "CREATE DATABASE auth_db;"
```

### Error: Backup File Corrupted

**Problem**: `Backup file is corrupted`

**Solution**:
```bash
# Test backup file
gzip -t backups/auth-db_auth_db_20250101_120000.sql.gz

# If corrupted, try another backup
./list-backups.sh
```

## Testing Restore Procedure

### Test Restore (Safe Test)

1. **Create a test backup**:
   ```bash
   ./backup-postgres.sh
   ```

2. **Note current data**:
   ```bash
   docker exec -it auth-db psql -U auth_user -d auth_db -c "SELECT COUNT(*) FROM users;"
   ```

3. **Add test data** (optional):
   ```bash
   docker exec -it auth-db psql -U auth_user -d auth_db -c "INSERT INTO users (phone_number, password) VALUES ('+1234567890', 'test');"
   ```

4. **Restore from backup**:
   ```bash
   ./restore-postgres.sh backups/auth-db_auth_db_YYYYMMDD_HHMMSS.sql.gz auth-db auth_db auth_user
   ```

5. **Verify data was restored** (test data should be gone):
   ```bash
   docker exec -it auth-db psql -U auth_user -d auth_db -c "SELECT COUNT(*) FROM users;"
   ```

## Best Practices

1. **Always backup before restore**: Create a backup of current state before restoring
2. **Test restores regularly**: Periodically test restore procedures
3. **Verify backups**: Check backup integrity before relying on them
4. **Document restore procedures**: Keep this guide updated
5. **Monitor restore logs**: Check for any errors during restore
6. **Verify data after restore**: Always verify data integrity after restore

## Recovery Time Objectives (RTO)

- **Backup Creation**: ~1-5 minutes (depending on database size)
- **Restore Time**: ~2-10 minutes (depending on database size)
- **Verification**: ~1-2 minutes

## Support

For issues:
1. Check restore logs
2. Verify container status: `docker-compose ps`
3. Test backup file: `gzip -t <backup-file>`
4. Review this guide

