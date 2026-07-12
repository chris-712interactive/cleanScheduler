# Platform SEO tasks (founder checklist)

**Status:** Implemented  
**Audience:** Platform admins only (`admin.<apex>`)  
**Related:** Public SEO architecture in `docs/marketing/seo.md`.

## Purpose

Give founders a concrete, checkable SEO task list in the admin portal — one-time post-deploy steps, GSC indexing requests, near-page-one page verification, and recurring monitoring reminders.

Task definitions are **versioned in code** (`lib/admin/seoTaskCatalog.ts`). Completions are stored in Postgres so progress persists across sessions.

## Routes

| Surface       | Path   |
| ------------- | ------ |
| SEO checklist | `/seo` |

Nav: **SEO** in the founder admin sidebar (between Outreach and Tenants).

## Architecture

```
lib/admin/seoTaskCatalog.ts   → task definitions (id, title, cadence, links)
lib/admin/seoTasks.ts         → merge catalog + DB completions
lib/admin/seoTaskActions.ts   → toggleSeoTaskAction (check / uncheck)
app/admin/seo/page.tsx        → server page + progress stats
app/admin/seo/SeoTaskChecklist.tsx → client toggle UI
platform_seo_task_completions → persisted completions (migration 0081)
```

## Task cadence

| Cadence     | Behavior                                |
| ----------- | --------------------------------------- |
| `once`      | Stays checked after completion          |
| `weekly`    | Due again 7 days after last completion  |
| `monthly`   | Due again 30 days after last completion |
| `quarterly` | Due again 90 days after last completion |

Recurring tasks show ↻ when due again. Checking them off updates `completed_at` and resets the timer.

## Categories

1. **Near-page-one pages** — verify live copy on priority URLs from the GSC query report
2. **Post-deploy validation** — Rich Results tests, www redirect, canonical tags
3. **Search Console indexing** — request indexing for priority URL groups
4. **Ongoing monitoring** — monthly GSC exports, coverage review, sitemap check
5. **When publishing SEO content** — sitemap registration, cross-links, indexing, tests

## Database

Migration `0081_platform_seo_task_completions.sql`:

```sql
platform_seo_task_completions (
  task_id text primary key,
  completed_at timestamptz,
  completed_by_user_id uuid,
  notes text,
  created_at, updated_at
)
```

RLS: `is_platform_admin()` only. Service role grants match other `platform_*` tables.

## Adding or changing tasks

1. Add a row to `SEO_TASK_CATALOG` in `lib/admin/seoTaskCatalog.ts` with a **stable `id`** (never rename ids once shipped — DB rows reference them).
2. Choose `category`, `cadence`, and optional `href` (public path or external GSC/Rich Results URL).
3. Update `docs/marketing/seo.md` if the task reflects a new public SEO page or GSC mapping.
4. Run `lib/admin/seoTasks.test.ts` — catalog ids must remain unique.

## Dashboard

The founder dashboard (`/`) shows an SEO summary card when the checklist loads: complete count, due count, and link to `/seo`.
