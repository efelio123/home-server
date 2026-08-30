# Home Server

A private, single-user family dashboard running on a Mac mini. It currently
includes authenticated notes and is intentionally designed to grow through
small, production-minded backend increments.

## Architecture

- Docker Compose runs the FastAPI application and PostgreSQL 17.
- FastAPI serves both the API and the static frontend on port `8000` for the
  home network.
- PostgreSQL is bound only to `127.0.0.1:5432`; it is not exposed to the LAN.
- A single user authenticates with an Argon2 password hash and a signed,
  HttpOnly session cookie.
- Secrets are supplied only through the root `.env` file, which is never
  committed.
- PostgreSQL data lives in the Docker-managed `postgres_data` volume.

Remote access is intentionally deferred. Do not add router port-forwarding or
public exposure; private VPN access and HTTPS are future work.

## Prerequisites

- Docker Desktop for Mac
- Docker Compose (`docker compose`)

Create a root `.env` file with these keys (use strong, unique values):

```dotenv
POSTGRES_USER=homeserver
POSTGRES_PASSWORD=...
POSTGRES_DB=home_server
APP_USERNAME=...
APP_PASSWORD_HASH=...
APP_SESSION_SECRET=...
```

Generate the password hash with the Python `pwdlib` Argon2 implementation used
by the app. Keep `.env` local only.

## Run

Build and start the stack:

```sh
docker compose up -d --build
```

Check service health:

```sh
docker compose ps
curl http://localhost:8000/health
```

Open `http://<reserved-Mac-mini-IP>:8000` from the home network. Use
`docker compose logs -f api` to inspect application logs.

## Backups and recovery

`./backup-db.sh` creates a compressed SQL dump in `backups/`, verifies its gzip
integrity, and removes backups older than 30 days. Google Drive for desktop
syncs this local directory; the script never writes into the Google Drive File
Provider directory.

The `com.felipe.homeserver-backup` LaunchAgent runs the script each day at
3:15 AM. Its output is written to `logs/backup.log` and
`logs/backup-error.log`.

Its `ProgramArguments` must explicitly use the production environment file:

```xml
<key>ProgramArguments</key>
<array>
  <string>/bin/zsh</string>
  <string>-lc</string>
  <string>cd /path/to/home-server &amp;&amp; ENV_FILE=.env.production ./backup-db.sh</string>
</array>
```

The production environment selects both `compose.yaml` and
`compose.production.yaml`, matching the deployment command. The script keeps
using `.env` when `ENV_FILE` is not provided for development compatibility.

Verify a backup without touching production by restoring it into a disposable
database:

```sh
docker compose exec -T postgres createdb -U homeserver home_server_restore_test
gunzip -c backups/home_server_YYYY-MM-DD_HH-MM-SS.sql.gz \
  | docker compose exec -T postgres psql -U homeserver -d home_server_restore_test
docker compose exec -T postgres dropdb -U homeserver home_server_restore_test
```

Restoring over the production database requires replacing its contents and is a
deliberate recovery operation. Stop the API first, confirm the exact backup and
target with `docker compose exec -T postgres psql -U homeserver -l`, then
perform that replacement only with a tested recovery runbook. Existing backups
and restores have been tested successfully.

## Development practices

- Keep changes small and commit each verified step.
- Never commit `.env`, `backups/`, `logs/`, Google Drive files, virtual
  environments, or Docker-generated data.
- Apply database changes through versioned migrations; do not edit the running
  schema manually.
- Add automated tests for API behavior and migration rules before expanding a
  dashboard feature.
