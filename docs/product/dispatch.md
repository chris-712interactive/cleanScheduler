# Suggest dispatch

Owners and admins on Business and Pro can suggest a crew and a stop order for one day. Starter, the free trial, and a paused Stripe subscription do not include it. The screen says which plan does. A past-due subscription keeps it.

## Where

- **Schedule → day view.** **Suggest dispatch**.
- **Schedule → Day map.** The same control, above the single-cleaner stop order.

Field employees do not see this control and cannot apply a plan.

## What you see

Each cleaner gets a colored list. The colors use the same palette as the day map. A total sits above the lists. Visits that are not placed are under **Unassigned**, with a reason.

A visit that is checked in, finished, a consultation, or has a fixed arrival window stays with its current crew. A visit that already has two or more people stays with that team. This screen does not build a new team.

Until a road engine is connected, miles are labeled **straight-line estimate**. They are not driving miles.

When the self-hosted road engine is connected, the same screen shows **drive time and miles**. One solve covers every cleaner. A stop the road network cannot reach is unassigned as **No road route**. If the engine is not set up, is turned off for this environment, or does not answer in time, the screen stays on the straight-line estimate.

## Apply

Nothing is saved when the suggestion opens. **Apply dispatch** reassigns the flexible visits and saves **Stop 1**, **Stop 2**, and so on for each cleaner. If the day changed after the suggestion was built, apply stops and asks you to suggest again.

Apply emails each cleaner whose crew or stop order actually changed. One message covers the whole day: what changed, the updated stops in the workspace timezone, and a link to that day on their schedule. It does not text anyone. The person who clicked Apply is left off that email when the change does not affect anyone else. Inactive members and members with no login email are skipped. The schedule still saves if email cannot be sent.

The schedule reads `route_sequence` when it exists. If migration **`0130`** has not been applied yet, apply stays off. Migration **`0133`** is the save step. Apply both by hand before using Apply dispatch. This change does not apply them for you.
