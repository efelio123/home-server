#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

if [[ "${APP_ENV:-}" != "development" ]]; then
  echo "Refusing to seed: APP_ENV must be development."
  exit 1
fi

docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  < db/seeds/development.sql

echo "Development seed data applied."