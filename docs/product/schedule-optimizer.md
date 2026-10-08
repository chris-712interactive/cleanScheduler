# Scheduling logic

Owners and admins weight how a day should be built at **Settings → Scheduling logic** (`/settings/scheduling`). The saved policy lives on `tenant_operational_settings.schedule_optimizer_policy` (migration `0100`). An empty object uses the built-in defaults, and new factors fill in when the catalog grows.

## What the business can control

Factors are grouped into crew eligibility, customer fit, time windows, travel and route, and workload. For each one the company can:

- Turn it off when it does not apply (a solo residential route does not need commercial certifications).
- Set a weight from 0 to 100.
- Choose **Prefer** or **Require** when the factor is allowed to reject a plan.

Work window, time off, double booking, and crew size always reject when they are enabled. Presets (Balanced, Residential routes, Commercial sites, Even workload) only change the form. They are stored when the page is saved.

Drive assumptions (speed, buffer between jobs, and the drive length that scores as too far) sit beside the weights. Distance is straight-line miles until road routing is connected.

## How a day is chosen

`planOptimizedDay` in `lib/schedule/optimizer/planDay.ts` takes jobs, crew, and a policy:

1. Place tight arrival windows and already-published visits first.
2. For each open job, try eligible crews and open gaps around jobs that are already pinned.
3. Hard factors throw out illegal options. Soft factors become a weighted score from 0 to 1.
4. The highest score wins. Ties prefer the shorter drive, then a stable crew id.

A factor with nothing to compare (no coordinates, no skill tags, no preferred cleaner) is skipped for that job. It does not punish the crew.

Crew inputs the scorer already understands include home base, skills, certifications, equipment, languages, property kind, pets, chemical sensitivity, entry tags, daily job and hour caps, preferred zones, partner preferences, experience, and weekend load. Job inputs include blocked and required cleaners, arrival and site-access windows, standing time, recurring cleaner, crew size, building key, priority, and revenue.

## Not wired yet

The settings page stores the policy. The schedule board still assigns crew by hand and the quote auto-scheduler still uses the earlier availability search. Both can call `planOptimizedDay` once customer and crew profiles are collected in the product. Coordinates are not stored on properties yet, so travel factors wait until a home base and a site location exist.
