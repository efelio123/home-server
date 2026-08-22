#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

migration_directory="db/migrations"

docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL

shopt -s nullglob

for migration_file in "$migration_directory"/*.sql; do
  migration_name="$(basename "$migration_file")"

  is_applied="$(
    docker compose exec -T postgres psql \
      -At \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -v migration_name="$migration_name" <<'SQL'
SELECT EXISTS (
  SELECT 1
  FROM schema_migrations
  WHERE version = :'migration_name'
);
SQL
  )"

  if [[ "$is_applied" == "t" ]]; then
    echo "Already applied: $migration_name"
    continue
  fi

  echo "Applying: $migration_name"

  {
    printf 'BEGIN;\n'
    cat "$migration_file"
    printf "INSERT INTO schema_migrations (version) VALUES (:'migration_name');\n"
    printf 'COMMIT;\n'
  } | docker compose exec -T postgres psql \
    -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -v migration_name="$migration_name"
done
