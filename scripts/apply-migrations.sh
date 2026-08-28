#!/usr/bin/env bash
set -euo pipefail

environment_file="${ENV_FILE:-.env}"

if [[ ! -f "$environment_file" ]]; then
  echo "Environment file not found: $environment_file" >&2
  exit 1
fi

set -a
source "$environment_file"
set +a

compose=(docker compose --env-file "$environment_file")

migration_directory="db/migrations"

"${compose[@]}" exec -T postgres psql \
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
    "${compose[@]}" exec -T postgres psql \
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
  } | "${compose[@]}" exec -T postgres psql \
    -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -v migration_name="$migration_name"
done
