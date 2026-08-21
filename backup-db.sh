#!/bin/zsh

set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$(dirname "$0")"
mkdir -p backups

retention_days=30

timestamp=$(date +%Y-%m-%d_%H-%M-%S)
backup_file="backups/home_server_${timestamp}.sql.gz"

docker compose exec -T postgres pg_dump -U homeserver -d home_server \
    | gzip > "$backup_file"

gzip -t "$backup_file"


find backups -maxdepth 1 -type f -name 'home_server_*.sql.gz' \
  -mtime +"$retention_days" -print -delete

echo "Local backup created and verified: $backup_file"
echo "Google drive will sync to this folder automatically."