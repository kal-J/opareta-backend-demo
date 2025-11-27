FROM alpine:latest

# Install required packages
RUN apk add --no-cache \
    postgresql-client \
    bash \
    dcron \
    tzdata \
    gzip \
    docker-cli

# Create backup directories
RUN mkdir -p /backups/data /backups/logs

# Copy backup scripts
COPY backup-postgres.sh /usr/local/bin/backup-postgres.sh
COPY list-backups.sh /usr/local/bin/list-backups.sh
COPY restore-postgres.sh /usr/local/bin/restore-postgres.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/*.sh

# Copy crontab file
COPY crontab /etc/cron.d/backup-postgres
RUN chmod 0644 /etc/cron.d/backup-postgres

# Create log file
RUN touch /var/log/cron.log

# Set timezone (optional, adjust as needed)
ENV TZ=UTC

# Volume for backups
VOLUME ["/backups/data", "/backups/logs"]

# Create entrypoint script that starts cron
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'set -e' >> /entrypoint.sh && \
    echo 'echo "Starting backup service..."' >> /entrypoint.sh && \
    echo 'echo "Scheduled backups: Daily at 2:00 AM"' >> /entrypoint.sh && \
    echo 'echo "Backup directory: /backups/data"' >> /entrypoint.sh && \
    echo 'echo "Log directory: /backups/logs"' >> /entrypoint.sh && \
    echo 'echo "Retention: 7 days"' >> /entrypoint.sh && \
    echo 'echo ""' >> /entrypoint.sh && \
    echo 'echo "To run manual backup:"' >> /entrypoint.sh && \
    echo 'echo "  docker exec db-backups /usr/local/bin/backup-postgres.sh"' >> /entrypoint.sh && \
    echo 'echo ""' >> /entrypoint.sh && \
    echo 'crond -l 2' >> /entrypoint.sh && \
    echo 'tail -f /var/log/cron.log' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Run entrypoint
CMD ["/entrypoint.sh"]

