# Gallurio Workflow Postgres

This stack is only for the Workflow DevKit Postgres World. Gallurio's product
data remains in MongoDB.

## Start the isolated database

Run these commands on the VPS from this directory:

```bash
cp .env.example .env
chmod 600 .env
# Edit .env and replace POSTGRES_PASSWORD with a long random value.
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

The database is persisted in the Docker volume
`gallurio-workflow-postgres-data`. PostgreSQL is bound to `127.0.0.1` only;
it is not reachable from the public internet.

## Bootstrap the Workflow schema

After the Gallurio release image is available on the VPS, run the setup command
from that image/container with `WORKFLOW_POSTGRES_URL` pointing at this database:

```bash
pnpm exec workflow-postgres-setup
```

The final app container should share the Compose network and use `workflow-postgres`
as the hostname. During this preparation phase, a host-side connection uses
`127.0.0.1` instead.

## Required application environment

```dotenv
WORKFLOW_TARGET_WORLD=@workflow/world-postgres
WORKFLOW_POSTGRES_URL=postgres://gallurio_workflow:<password>@workflow-postgres:5432/gallurio_workflow
```

Do not use the Local World in production. Keep the password out of images,
source control, logs, and CI output.

## Backups

The Docker volume is not a backup. Schedule a `pg_dump` to an off-server,
encrypted destination and test restoring it before accepting real checkout
traffic. Keep the database volume and backup credentials separate from the app
container.
