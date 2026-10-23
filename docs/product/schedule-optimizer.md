# Scheduling logic

Owners and admins weight how a day should be built at **Settings → Scheduling logic** (`/settings/scheduling`). The saved policy lives on `tenant_operational_settings.schedule_optimizer_policy` (migration `0100`). An empty object uses the built-in defaults, and new factors fill in when the catalog grows.

## What the business can control

Factors are grouped into crew eligibility, customer fit, time windows, travel and route, and workload. For each one the company can:

- Turn it off when it does not apply (a solo residential route does not need commercial certifications).
- Set a weight from 0 to 100.
- Choose **Prefer** or **Require** when the factor is allowed to reject a plan.

Work window, time off, double booking, and crew size always reject when they are enabled. Presets (Balanced, Residential routes, Commercial sites, Even workload) only change the form. The chosen starting point fills in as the selected button, and a note under the row confirms the weights below updated. They are stored when the page is saved.

Drive assumptions (speed, buffer between jobs, and the drive length that scores as too far) sit beside the weights. Distance is straight-line miles until road routing is connected.

## How a day is chosen

`planOptimizedDay` in `lib/schedule/optimizer/planDay.ts` takes jobs, crew, and a policy:

1. Place tight arrival windows and already-published visits first.
2. For each open job, try eligible crews and open gaps around jobs that are already pinned.
3. Hard factors throw out illegal options. Soft factors become a weighted score from 0 to 1.
4. The highest score wins. Ties prefer the shorter drive, then a stable crew id.

A factor with nothing to compare (no town on the job, no skill tags, no preferred cleaner) is skipped for that job. It does not punish the crew. When the job has a city, state, or postal code, a home in that town outranks a home in another state, and a home with no town at all. Map coordinates still win when both the home and the job have them.

Crew inputs the scorer already understands include home base, skills, certifications, equipment, languages, property kind, pets, chemical sensitivity, entry tags, daily job and hour caps, preferred zones, partner preferences, experience, and weekend load. Job inputs include blocked and required cleaners, arrival and site-access windows, standing time, recurring cleaner, the property’s crew size, building key, priority, and revenue.

## What the planner reads

Settings → Scheduling logic stores the weights. A day suggestion on the schedule loads the rest:

- Work windows, approved time off, and visits already assigned
- Recurring anchor time, the last cleaner on that rule, and whether the customer has a completed visit
- Service zone, postal code, building name, and visit price
- Customer scheduling defaults: preferred weekdays, morning / afternoon / evening, preferred, required, and blocked cleaners, arrival and access hours, pets, sensitivity, languages, entry tags, priority, skills, certifications, equipment, and key pickup. The customer sets days and time of day in the customer portal under Settings, using a week of day buttons and time-of-day choices. The saved time stays selected after they save. The office sets the same defaults on the customer record. Days and time stay open. Arrival and access, cleaners, and skills and home stay collapsed, and each header shows what is already set. A location replaces those defaults only when **Custom scheduling for this location** is checked inside that service location. The fields stay hidden until the box is checked. A specific arrival window replaces the time of day. When only a time of day is saved, the day planner treats that block as when the visit should start (morning 8:00–12:00, afternoon 12:00–4:00, evening 4:00–8:00). The visit may run past the end of the block so it can finish inside the workday.
- Crew size on the property (`tenant_customer_properties.required_crew_size`, 1–8, default 1). One owner can have a different crew at each site. The office sets it on the service location. A consultation asks for it on every property type, and saving that consultation writes it onto the location. A quote asks for it beside the priced lines, stores it on the quote, and saving the quote writes it onto the service location. Each job type also has a minimum crew (`tenant_service_templates.default_crew_size`, migration **`0111`**), edited under Settings → Job types. Deep cleaning starts at 2. The day planner assigns the higher of the location crew and that job type’s minimum, matched from the quote line or the visit title. A visit with no property and no matching job type stays at one cleaner. Apply migration **`0108`** and **`0111`**.
- Crew scheduling profile: skills, certifications, equipment, languages, entry tags, property types, pets, sensitivity, experience, daily caps, preferred zones, partners, and home address. An owner or admin sets experience, max jobs per day, max minutes per day, and max drive on the employee record. A field employee sees those values on Account and cannot change them. The planner uses the saved city, state, and postal code when map coordinates are missing, so a cleaner who lives in the job’s town is chosen ahead of one who lives in another state. An owner or admin can opt out of jobs, consultations, or both on their profile. Opting out of jobs keeps a shorter consultation profile. Opting out of both hides availability and the scheduling profile, and the planner will not assign them.
- A cleaner whose home is about three hours or more from the job is left off the automatic crew. If a deep clean needs two people and only one can reach it, that person is assigned and the visit stays short-staffed instead of going out with nobody. On the visit, the assign list marks that far cleaner **Too far from this location** instead of Available. Latitude and longitude saved when a US address is geocoded. Google Geocoding is used when `GOOGLE_MAPS_GEOCODING_API_KEY` is set; the Census geocoder is the fallback. An unchanged address keeps its saved point. A service location added on a quote is geocoded when the quote is saved. Accepting the quote looks the point up again when it is still missing, before any automatic visit is created. Fill schedule does the same lookup before it chooses a crew, so a home with coordinates is compared to the job instead of treated as a zero-minute drive. That drive is usually a fraction of a minute. The visit is saved at the nearest whole minute, so the crew choice is not dropped on the way onto the calendar. A pair starts when the later person can arrive. The visit is left open only when that later start does not fit the workday. When a home, service location, or business address has text but no point, the office shows **Missing map point** and the reason (no match, key rejected, outside the US, too short, or the service did not respond). Apply migration **`0109`**. Drive time stays straight-line. Road miles and live traffic are not called.

Applying a suggestion writes the visit time and crew through the existing schedule actions.

## Fill a day, week, month, or range

**Schedule → Fill schedule** (`/schedule/fill`) writes visits for the period the office picks. **Schedule these** slips to a live status screen: each visit appears as it is saved, crew updates follow day by day, and the finished screen lists what was placed, who has a crew, what stayed open, and what was left off, with links to the schedule, the customer, and any visit that still needs a crew. Each row shows the street, so two properties for the same customer stay distinct. A job left off names that street too.

- Service visits come from accepted quotes that have not been replaced. Inactive customers are skipped.
- Weekly, every-two-weeks, and monthly lines keep that gap from the last visit on that quote line. A line that has never been visited uses the last visit at that same property, not a visit at the customer's other property. A closed day, or a due date a few days before the period, moves onto the next open workday. It does not add an extra visit inside the gap. When the customer has preferred weekdays, the visit lands on the first of those days that is still open inside that gap. If none of them are, it uses the next open workday. When the next visit falls after the period, the left-off note names that date. **This month** is the calendar month, clipped so it does not start in the past. A fill on October 20 covers October 20–31. A longer window is a date range.
- A one-time line is placed once, on the first open day in the period, or on the first preferred weekday when the customer named some. The visit keeps the quote line, so marking that visit complete checks the job off. A completed one-time job is not placed again and is not listed as left off. A one-time job that is still scheduled stays off the new run and is listed so it is not booked twice.
- Morning, afternoon, and evening set the visit start when no tighter arrival window is saved. Morning starts around 8:00, afternoon around noon, and evening around 4:00, clipped so the job still finishes by the end of the business day. If that preferred start is too late to finish before closing, the day planner keeps the time already on the visit and assigns anyone who can work that clock time.
- When a property has an initial clean, the first weekly, every-two-weeks, or monthly visit at that property waits one full cycle after it (a week, two weeks, or a month). A biweekly clean starts two weeks after the deep clean. Fill schedule always does this. An initial clean is a one-time line, a job type whose schedule role is Initial visit, or a line named like “Initial Deep Cleaning” or “Deep clean.” The match is the customer and the street, so two property records for the same address still wait. Another property is not held back. Line order on the quote does not matter. Accepting a quote uses the same rule when Operations → “recurring starts after the initial visit” is on.
- A custom cadence is treated as weekly until the quote stores a specific interval.
- New website leads get one consultation. If they named a date, that date is used when it falls in the period. Morning, afternoon, and evening shift the start time. A lead becomes a customer when they do not already have one. Leads that already have a consultation are skipped.
- A customer can request another location from the portal. That location is saved and waits for its own consultation. The office dashboard and the customer record offer to schedule it. When consultations are required before a quote, a quote for that location waits until the walkthrough is marked complete. Apply migration **`0110`**.
- Running the same period again does not duplicate a visit that is still inside the cadence.
- After the visits exist, the day planner assigns crew with the company's scheduling rules. A visit nobody can work at that time stays open for the office.
- **Undo this run** removes the visits from that fill. A visit that is already finished, cancelled, or checked in stays on the calendar and is listed. Consultations that come off the calendar leave the website lead open to book again. The fill page also offers undo for recent runs that are still scheduled.

## Not in this pass

Paid road routing and live traffic. A factor with an empty field still skips that job.
