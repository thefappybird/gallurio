#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Missing deploy/postgres/.env" >&2
  exit 1
fi

set -a
source .env
set +a

: "${POSTGRES_DB:?POSTGRES_DB must be set}"
: "${POSTGRES_USER:?POSTGRES_USER must be set}"

backup_dir="${BACKUP_DIR:-/var/backups/gallurio/workflow-postgres}"
mkdir -p "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$backup_dir/${POSTGRES_DB}-${timestamp}.dump"

docker compose --env-file .env exec -T workflow-postgres \
  pg_dump --format=custom --no-owner --no-privileges \
  --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" > "$output"

chmod 600 "$output"
echo "Created $output"
