# Platform sales pipeline

**Status:** Implemented (v1)  
**Audience:** Platform admins and the **sales** closer role (`admin.<apex>`)  
**Related:** [platform-outreach.md](./platform-outreach.md)

## Purpose

Give a commission closer (and the founder) a shared CRM on the admin portal:

- Who reached out to a prospect
- Scheduled demos and demo results
- Where the company is in signup (new → contacted → demo → trial → closing → won)
- Tasks when a free trial is within 3 days of expiring

Sales users **cannot** access tenants, fraud, accounting, audit, SEO, inquiries, or support.

## Role

| `app_role`              | Admin portal      | Pipeline + outreach | Founder tools |
| ----------------------- | ----------------- | ------------------- | ------------- |
| `super_admin` / `admin` | Yes               | Yes                 | Yes           |
| `sales`                 | Yes (limited nav) | Yes                 | No            |

Invite a closer from **Settings → Invite sales**. MFA is required. They land on the canonical `admin.<apex>` origin after sign-in. A nested hostname whose first label is `admin` (for example `admin.evil.<apex>`) is not the admin portal. Platform staff who sign in on the real admin host stay on that canonical origin even when they also have a workspace membership. Password sign-in to `/` loads that page as a document request, so the first paint is the founder or sales dashboard. A membership role named admin is not this platform role. Session cookies stay on the host that set them. There is no cross-host handoff.

## Routes

| Surface                | Path                            |
| ---------------------- | ------------------------------- |
| Sales dashboard        | `/` (sales role)                |
| Pipeline board + tasks | `/pipeline`                     |
| New lead               | `/pipeline/new`                 |
| Lead detail            | `/pipeline/[id]`                |
| Add from outreach      | Campaign recipient **Pipeline** |

## Workflow

1. Import / send outreach (existing campaigns).
2. **Pipeline** on a recipient, or **New lead**, assigns the closer as owner.
3. Log outreach/call/email. Schedule a demo (creates a demo task).
4. Record demo result → stage moves (interested → closing, no-show → contacted, not interested → lost).
5. Self-serve trial signup upserts a lead at stage **On trial**.
6. Daily trial cron (`/api/cron/expire-stale-trials`) creates a **Trial expiring** task for the assigned closer (or unassigned).
7. Paid subscription marks the lead **Won** and closes open tasks.

## Schema

- `0091_platform_sales_role.sql` — `app_role` value `sales`
- `0092_platform_sales_pipeline.sql` — `is_platform_staff()`, leads, activities, tasks; outreach RLS uses staff

Apply **0091 then 0092** on each Supabase environment.
