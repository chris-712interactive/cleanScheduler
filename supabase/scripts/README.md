# Supabase scripts

## PROD one-shot schema (`build-prod-baseline.sh`)

If you have a **new, empty** Supabase (or Postgres) database and want the same schema as this repo **without** stepping through each migration file manually in the Dashboard:

1. Regenerate the bundle (always do this after pulling new migrations):

   ```bash
   chmod +x supabase/scripts/build-prod-baseline.sh
   ./supabase/scripts/build-prod-baseline.sh
   ```

   Output defaults to `supabase/scripts/generated/prod_baseline.sql` (gitignored).

2. Apply to PROD (replace with your connection string from Supabase → Settings → Database):

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/generated/prod_baseline.sql
   ```

3. **Supabase migration history**: the SQL editor does not record rows in `supabase_migrations.schema_migrations`. If you later want `supabase db push` / CLI history to match PROD, either:
   - use the Supabase CLI against PROD with linked project and `supabase db push` (recommended long-term), or
   - insert the migration version rows manually to match what was applied (advanced).

**Important**

- Run only on a database with **no existing cleanScheduler tables** (or drops first — not covered here).
- The bundle is equivalent to running `0001` … `0021` in order; it does not include `supabase/seed/*.sql` (dev smoke data).

## Ongoing workflow (DEV → PROD)

After the initial bootstrap, prefer applying **new** migrations with the same ordered files (or CLI) so PROD stays aligned with git.
