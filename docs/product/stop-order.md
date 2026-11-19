# Suggest stop order

Owners and admins can suggest a stop order for one cleaner's day. It is included on every plan, including Starter and the trial. There is no add-on and no extra charge.

## Where

- **Schedule → day view.** Choose one person in **Crew member**, then **Suggest stop order**.
- **Schedule → Day map.** Choose that person under **Cleaner**, then **Suggest stop order**.

Field employees do not see this control and cannot apply an order.

## What you see

The suggestion lists the stops that have a map point. A stop with a fixed arrival window, a consultation, or a visit that is already checked in or finished stays in time order. Other stops can move around those fixed ones.

Visits with no usable point are listed under **Not routed**, with the same reason as the day map (for example **Couldn't locate this address** or **Lookup will retry**).

Miles are labeled **straight-line estimate**. They are not driving miles and they do not use live traffic.

The path starts at the business address when that address has a map point. Otherwise it starts at the first stop.

## Apply

**Apply stop order** saves the suggestion. The day view shows **Stop 1**, **Stop 2**, and so on on those visits. The order stays until someone applies a new suggestion. Cancelling a visit does not renumber the others.

Apply migration **`0130`** before deploying this page. The schedule and the day map both read `route_sequence`. Until that column exists, those pages cannot load.
