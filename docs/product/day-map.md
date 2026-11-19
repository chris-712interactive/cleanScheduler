# Day map

Office staff who can open the schedule can see one day of visits on a map at **Schedule → Day map** (`/schedule/map`). It is included for every plan. There is no paid map add-on. Field employees stay on their own schedule and cannot open this page.

## What you see

- A day picker. Previous day and next day keep the same page.
- A pin for each scheduled or completed visit whose service location has a latitude and longitude. Cancelled visits are left off.
- The pin color follows the assigned cleaner. A visit with more than one cleaner uses the cleaner whose name comes first in the alphabet for the color, and the details name everyone. A visit with nobody assigned is gray and labeled Unassigned.
- The legend counts the pins in each color.
- Clicking a pin shows the customer, the time window, and the assigned cleaner, with a link to that visit.
- The same visits are listed beside the map, so the day is still readable if the tiles do not load.
- A visit with no usable point is listed under **Needs a map point**, with the reason (for example **Couldn't locate this address** or **Lookup will retry**) and a link to fix the address on the customer. The visit's own service location is used. Another location on that customer is not substituted when the visit already has one. When the visit has no location, the customer's primary location is used, which is the same fallback as the schedule card.

The day is the workspace timezone, the same calendar day as the schedule.

## Map tiles

The map is [MapLibre GL JS](https://maplibre.org/). It is loaded only on this page.

`NEXT_PUBLIC_MAP_STYLE_URL` is the style JSON URL. It is public (the browser requests the tiles), so it must not contain an API key. Leave it blank to use the default.

**Default:** `https://tiles.openfreemap.org/styles/liberty` (OpenFreeMap Liberty).

OpenFreeMap serves OpenStreetMap data in the OpenMapTiles schema. Their public instance:

- Allows this use, including commercial use, with no API key and no stated cap on map views.
- Requires attribution. MapLibre adds it from the style: OpenFreeMap, OpenMapTiles, and OpenStreetMap.
- Does not offer an SLA or a support contract. Availability is best-effort.
- Limits bulk offline downloads (not used here) to 3,000 tiles or 50 MB.

Production should set `NEXT_PUBLIC_MAP_STYLE_URL` to a style that reads a self-hosted Protomaps PMTiles file. A Mapbox or Google style URL is ignored and the OpenFreeMap default is used instead. Google Maps and Mapbox are not loaded.

Changing the variable needs a new build, like other `NEXT_PUBLIC_` settings. It is documented in `.env.example`. Do not commit a key.
