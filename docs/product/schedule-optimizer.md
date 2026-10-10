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

## What the planner reads

Settings → Scheduling logic stores the weights. A day suggestion on the schedule loads the rest:

- Work windows, approved time off, and visits already assigned
- Recurring anchor time, the last cleaner on that rule, and whether the customer has a completed visit
- Service zone, postal code, building name, and visit price
- Customer scheduling defaults and a property override: preferred, required, and blocked cleaners, arrival and access hours, pets, sensitivity, languages, entry tags, priority, crew size, skills, certifications, equipment, and key pickup
- Crew scheduling profile: skills, certifications, equipment, languages, entry tags, property types, pets, sensitivity, experience, daily caps, preferred zones, partners, and home coordinates
- Latitude and longitude saved when a US address is geocoded (Census). Drive time stays straight-line. Road miles and live traffic are not called.

Applying a suggestion writes the visit time and crew through the existing schedule actions.

## Fill a day, week, month, or range

**Schedule → Fill schedule** (`/schedule/fill`) writes visits for the period the office picks. **Schedule these** slips to a live status screen: each visit appears as it is saved, crew updates follow day by day, and the finished screen lists what was placed, who has a crew, what stayed open, and what was left off, with links to the schedule, the customer, and any visit that still needs a crew.

- Service visits come from accepted quotes that have not been replaced. Inactive customers are skipped.
- Weekly, every-two-weeks, and monthly lines keep that gap from the customer's last visit. A closed day, or a due date a few days before the period, moves onto the next open workday. It does not add an extra visit inside the gap.
- A one-time line is placed once, on the first open day in the period, and only if that line is not already on the calendar.
- A custom cadence is treated as weekly until the quote stores a specific interval.
- New website leads get one consultation. If they named a date, that date is used when it falls in the period. Morning, afternoon, and evening shift the start time. A lead becomes a customer when they do not already have one. Leads that already have a consultation are skipped.
- Running the same period again does not duplicate a visit that is still inside the cadence.
- After the visits exist, the day planner assigns crew with the company's scheduling rules. A visit nobody can take stays open for the office.
- **Undo this run** removes the visits from that fill. A visit that is already finished, cancelled, or checked in stays on the calendar and is listed. Consultations that come off the calendar leave the website lead open to book again. The fill page also offers undo for recent runs that are still scheduled.

## Not in this pass

Paid road routing and live traffic. A factor with an empty field still skips that job.
