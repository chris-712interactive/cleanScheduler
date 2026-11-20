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

**Schedule → Start locations** lets the office add places besides the business address, such as a second office. Each cleaner can start at the office, at home, or at one of those places, and can end at a return point. Leave the day blank for the default. Fill in a day to override that date only. The form shows the saved default, and any day that already has its own start or end.

Ordering and dispatch use that start and end. Home streets are shown on this page to the office only.

A new place is looked up with the same US address geocoder as service locations. A failed lookup still saves the place, and the route falls back until a map point exists. Deleting a place sends every cleaner who started or ended there back to the office, with no return stop.

## Drive time

**Schedule → Drive time** is a date range of minutes, miles, and stop counts per cleaner and per day. The numbers are the ones saved when the office applied a route. Opening the report does not call the routing engine.

A row from the road engine says **Engine drive time** and **drive mi**. A row from the fallback says **straight-line estimate** and is not driving miles. The two totals stay separate. **Download CSV** uses the same labels.

Apply migration **`0134_pro_routing_extras.sql`** by hand before using these tools. This change does not apply it for you. Stop order still needs **`0130`**, and dispatch apply still needs **`0133`**.
