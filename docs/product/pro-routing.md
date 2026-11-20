# Pro routing extras

Routing stays part of the plan. It is not a separate purchase. Starter includes the day map and a stop order for one cleaner. Business adds dispatch for the whole crew. Pro adds the three tools on this page.

Starter, Business, and the free trial see: "This feature is included in the Pro plan. Upgrade your plan to use it." They do not see a way to buy an add-on.

Field employees do not see these tools. Opening Start locations or Drive time sends them back to their jobs. A field employee still edits their own home from Account. They do not see another person's home.

## Re-optimize

On **Schedule → day view** and **Schedule → Day map**, after a stop order or a dispatch has been applied, a later change to that day offers **Re-optimize**. A change is a visit added, cancelled, moved, or rescheduled, or approved time off that overlaps the day.

**Re-optimize** builds a new suggestion. Visits that are finished, checked in, or locked to a time stay with the same cleaner and the same stop number. Nothing is saved until **Apply re-optimize**. If the day changed again after the suggestion was built, apply stops and asks you to re-optimize.

Apply uses the same save as dispatch and emails each cleaner whose crew or stop order changed. It does not text anyone. On this environment, outbound mail stays off when `OUTBOUND_SUPPRESSED=1`.

Until the road engine is connected, miles are a **straight-line estimate**. They are not driving miles.

## Start locations

**Schedule → Start locations** lets the office add places besides the business address, such as a second office. **Edit** changes that place's name and street. Cleaners who already start or end there keep the same place. Each cleaner can start at the office, at home, or at one of those places, and can end at a return point. Leave the day blank for the default. Fill in a day to override that date only. The form shows the saved default, and any day that already has its own start or end.

Ordering and dispatch use that start and end. Home streets are shown on this page to the office only.

A new place, and an edit that changes the street, city, state, or postal code, is looked up with the same US address geocoder as service locations. Saving the same address again does not look it up. A failed lookup of a new place still saves it, and the route falls back until a map point exists. If an edit cannot look up the new address, the place is left as it was, including its map point. Two places in one workspace cannot share a name. Deleting a place sends every cleaner who started or ended there back to the office, with no return stop.

## Drive time

**Schedule → Drive time** is a date range of minutes, miles, and stop counts per cleaner and per day. The numbers are the ones saved when the office applied a route. Opening the report does not call the routing engine.

A row from the road engine says **Engine drive time** and **drive mi**. A row from the fallback says **straight-line estimate** and is not driving miles. The two totals stay separate. **Download CSV** uses the same labels.

Apply migration **`0134_pro_routing_extras.sql`** by hand before using these tools. Shared dev and production already have `0134`. Do not edit that file. Apply **`0135_route_base_active_member.sql`** by hand so an office save cannot attach a start to someone who is not an active member of that workspace. This change does not apply `0135`. Stop order still needs **`0130`**, and dispatch apply still needs **`0133`**.
