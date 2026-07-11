# Outreach enrichment resume checkpoint

Saved: **2026-07-11**

Paused to conserve tokens. Discovery for all Top 20 metros is done; enrichment is partially complete.

## Status
- Discovery candidates: **980**
- Metros enriched: **11 / 20**
- CSV rows so far: **445**
- Emailable so far: **305**

## Completed metros
- `atlanta` — 36 rows, 30 emailable — `outreach/atlanta-cleaning-outreach-mailmerge.csv`
- `chicago` — 44 rows, 31 emailable — `outreach/chicago-cleaning-outreach-mailmerge.csv`
- `dallas-fort-worth` — 52 rows, 30 emailable — `outreach/dallas-fort-worth-cleaning-outreach-mailmerge.csv`
- `denver` — 40 rows, 31 emailable — `outreach/denver-cleaning-outreach-mailmerge.csv`
- `houston` — 48 rows, 35 emailable — `outreach/houston-cleaning-outreach-mailmerge.csv`
- `miami` — 37 rows, 24 emailable — `outreach/miami-cleaning-outreach-mailmerge.csv`
- `orlando` — 33 rows, 18 emailable — `outreach/orlando-cleaning-outreach-mailmerge.csv`
- `riverside` — 31 rows, 19 emailable — `outreach/riverside-cleaning-outreach-mailmerge.csv`
- `san-diego` — 44 rows, 33 emailable — `outreach/san-diego-cleaning-outreach-mailmerge.csv`
- `seattle` — 44 rows, 32 emailable — `outreach/seattle-cleaning-outreach-mailmerge.csv`
- `tampa` — 36 rows, 22 emailable — `outreach/tampa-cleaning-outreach-mailmerge.csv`

## Resume next (in order)

- `philadelphia` — ~46 website-pending candidates
- `san-francisco` — ~39 website-pending candidates
- `minneapolis` — ~41 website-pending candidates
- `detroit` — ~35 website-pending candidates
- `washington-dc` — ~37 website-pending candidates
- `phoenix` — ~11 website-pending candidates
- `boston` — ~11 website-pending candidates
- `new-york` — ~81 website-pending candidates
- `los-angeles` — ~80 website-pending candidates

## How to resume
1. Open `outreach/candidates/RESUME.json` for machine-readable state.
2. Enrich next metros with **composer-2.5-fast**, ~17 per batch, contact-only.
3. Write results under `outreach/candidates/enrichment-queues/`.
4. Merge to `outreach/{metro}-cleaning-outreach-mailmerge.csv` and update master JSON.
5. Keep excluding SWFL lists + already-enriched candidates.

## Key files
- `outreach/candidates/us-top20-cleaning-candidates.json` — master candidates + enrichment fields
- `outreach/candidates/metro-progress.json` — metro tab + per-metro CSV stats
- `outreach/candidates/enrichment-priority.json` — priority order
- `outreach/candidates/_exclude-swfl.json` — SWFL exclusion keys

