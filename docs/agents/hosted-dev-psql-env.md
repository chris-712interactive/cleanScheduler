# Hosted dev psql environment

Learned while closing the QA note on the direct SQL RLS `psql` invocation.

`assertDevDatabaseUrl` accepts `QA_DEV_DATABASE_URL` only for project `khodybakkdpheqkoycgi`, and only when the deployment identity host is that same project. That check does not bind the TCP connection by itself. libpq fills any connection parameter the process did not set from inherited `PG*` variables. `PGHOSTADDR` selects the address even when `PGHOST` is the host from the checked URL. `PGSERVICE` and `PGSERVICEFILE` load more parameters from a service file. `PGPASSFILE`, `PGOPTIONS`, and an inherited `PGSSLMODE` can change the password source, startup options, or TLS mode.

`psqlChildEnv` copies the parent environment, drops every `PG` and `pg` prefixed name, then sets `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and `PGSSLMODE` from the checked URL. It does not set `PGCONNECT_TIMEOUT`. The direct SQL test in `tests/hosted-dev/isolated.spec.ts` passes that object to `psql` after `assertDevDatabaseUrl` and `platformAdminFixtureBlock`. A parent environment with none of those variables set still connects to the same host, port, database, user, and TLS mode as before.

The isolated job in `.github/workflows/hosted-dev.yml` unsets exported `PG*` names before `npm run test:hosted-dev:isolated`. The shell does not print those values or the database URL. The child strip still has to stay in `psqlChildEnv`, because a later step or a local run can export the variables again.

Do not spread `process.env` back into the `psql` environment. Do not pass the URL on the command line and leave `PGHOSTADDR` or `PGSERVICE` in the environment. Do not weaken `assertDevDatabaseUrl`, `platformAdminFixtureBlock`, or the redaction of `QA_DEV_DATABASE_URL`.

The isolated job checks out `main` and GitHub executes this workflow from `main`. A copy of this change that exists only on `dev` does not change the live isolated job until it is ported to `main`.
