# Suggest stop order

Owners and admins can suggest a stop order for one cleaner's day. It is included on Starter, Business, Pro, and the free trial. The screen is not locked behind a higher tier.

## Where

- **Schedule → day view.** Choose one person in **Crew member**, then **Suggest stop order**.
- **Schedule → Day map.** Choose that person under **Cleaner**, then **Suggest stop order**.

Field employees do not see this control and cannot apply an order.

## What you see

The suggestion lists the stops that have a map point. A stop with a fixed arrival window, a consultation, or a visit that is already checked in or finished stays in time order. Other stops can move around those fixed ones.

Visits with no usable point are listed under **Not routed**, with the same reason as the day map (for example **Couldn't locate this address** or **Lookup will retry**).

Until a road engine is connected, miles are labeled **straight-line estimate**. They are not driving miles and they do not use live traffic.

When the self-hosted road engine is connected, the same screen shows **drive time and miles** for the suggested order and for the order the day already had. A stop the road network cannot reach is listed under **Not routed** as **No road route**. If the engine is not set up, is turned off for this environment, or does not answer in time, the screen stays on the straight-line estimate. The office does not have to do anything for that fallback.

The path starts at the business address when that address has a map point. Otherwise it starts at the first stop.

## Apply

**Apply stop order** saves the suggestion. The day view shows **Stop 1**, **Stop 2**, and so on on those visits. The order stays until someone applies a new suggestion. Cancelling a visit does not renumber the others.

When the saved numbers change, that cleaner gets one email with the new order and a link to the day. Someone else assigned to the same visit gets the same note if their stop number changed. See `docs/product/cleaner-schedule-email.md`.

The schedule and the day map read `route_sequence` when it exists. If migration **`0130`** has not been applied yet, those pages still load and stop numbers stay blank. **Apply stop order** stays off until the column is there. Apply the migration by hand before saving an order.
