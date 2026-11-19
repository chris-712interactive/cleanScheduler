# Self-hosted routing engine

Valhalla builds a drive-time matrix. VROOM orders one cleaner's stops. Caddy is the only process on the public internet. It terminates TLS and requires `Authorization: Bearer <token>`.

Clean Scheduler calls this from the server when `ROUTING_ENGINE_URL` and `ROUTING_ENGINE_TOKEN` are set. When they are unset, or the engine is slow, down, or suppressed, the schedule keeps the straight-line stop order. Nothing in this folder is required for the app to run.

The sample map is North Carolina, because the local demo office is in western North Carolina. Use your own state extract.

## What you need

One Ubuntu VPS, any provider. Do not put this on the Vercel app.

| Extract       | Download  | Disk for the graph | RAM to build | RAM to serve | This VPS                              |
| ------------- | --------- | ------------------ | ------------ | ------------ | ------------------------------------- |
| One state     | ~0.2–1 GB | ~2–8 GB            | 8 GB         | 2–4 GB       | 4 vCPU, 8 GB RAM, 40 GB disk          |
| A US region   | ~2–4 GB   | ~15–30 GB          | 16–32 GB     | 8 GB         | 8 vCPU, 16 GB RAM, 80 GB disk         |
| All of the US | ~10 GB    | ~40–80 GB          | 64 GB        | 16–32 GB     | No. Build elsewhere, or stay regional |

A one-state box is about $20–45 a month. If the tile build is killed, resize to 16 GB RAM, build once, then serving often fits back in 8 GB. All-US tiles do not fit the small box. Elevation is off, which keeps the build smaller. These sizes are ranges, not a quote from a host.

## 1. DNS and the firewall

Create an A record from `routing.example.com` to the VPS. Open TCP 22, 80, and 443 only. Do not open 8002 or 3000.

```bash
sudo apt update
sudo apt install -y ca-certificates curl
# Docker's Ubuntu install:
# https://docs.docker.com/engine/install/ubuntu/
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Configure

On the VPS, from this directory (`infra/routing`):

```bash
cp .env.example .env
openssl rand -hex 32
```

Put that hex value in `ROUTING_ENGINE_TOKEN`. Set `ROUTING_DOMAIN` to the DNS name and `ACME_EMAIL` to a real mailbox. The token is a shared secret. It is not a user password and it does not go in the URL.

### Choose the map

`TILE_URLS` is a Geofabrik extract. State files are listed at <https://download.geofabrik.de/north-america/us.html>.

```bash
# One state. Replace north-carolina with the state slug from that page.
TILE_URLS=https://download.geofabrik.de/north-america/us/north-carolina-latest.osm.pbf

# A region, for example the US South (heavier than one state).
TILE_URLS=https://download.geofabrik.de/north-america/us/south-latest.osm.pbf

# All of the US. Needs the large machine in the table above.
TILE_URLS=https://download.geofabrik.de/north-america/us-latest.osm.pbf
```

One URL is enough. Several state URLs can be space-separated in `TILE_URLS` if you want two neighboring states and not a whole region.

Changing region later means deleting `custom_files/` and building again. The old graph will not route outside its extract.

## 3. Start

```bash
docker compose up -d
docker compose logs -f valhalla
```

The first boot downloads the extract and builds tiles. A state can take a while. Leave it until the log says Valhalla is listening. Later boots reuse `custom_files/` and skip the build.

## 4. Health check

```bash
curl -fsS \
  -H "Authorization: Bearer $ROUTING_ENGINE_TOKEN" \
  "https://$ROUTING_DOMAIN/health"
```

`{"ok":true,"failed":[]}` means Valhalla and VROOM both answered. `401` means the token did not match. `503` means one of them is still starting. A request without the header is rejected. The Caddy log drops the `Authorization` header.

## 5. Point the app at it

On the app server only (Vercel production when you are ready). Never use a `NEXT_PUBLIC_` name.

| Name                        | Value                            |
| --------------------------- | -------------------------------- |
| `ROUTING_ENGINE_URL`        | `https://routing.example.com`    |
| `ROUTING_ENGINE_TOKEN`      | the same hex secret              |
| `ROUTING_ENGINE_TIMEOUT_MS` | optional, 200–8000, default 3000 |

Leave both blank until the VPS is up. Hosted dev sets `OUTBOUND_SUPPRESSED=1`, and then the app does not call this engine even if the URL is set.

The schedule waits at most 3 seconds for the matrix and the solve together. Right after Valhalla loads its graph, that can miss the deadline and that one page shows the straight-line estimate. The next load uses the engine. Raise `ROUTING_ENGINE_TIMEOUT_MS` if that keeps happening.

The schedule page sends coordinates and numeric ids. It does not send customer names. The browser never sees the URL or the token.

## Update the map

Geofabrik refreshes extracts often. Once a month is enough for stop order.

```bash
# In .env
FORCE_REBUILD=True
docker compose up -d valhalla
docker compose logs -f valhalla
```

When the new graph is serving, set `FORCE_REBUILD=False` and run `docker compose up -d valhalla` again so the next reboot does not rebuild.

To switch extracts, stop the stack, remove `custom_files/`, change `TILE_URLS`, and start again.

## Images

| Service  | Image                                            |
| -------- | ------------------------------------------------ |
| Valhalla | `ghcr.io/gis-ops/docker-valhalla/valhalla:3.5.1` |
| VROOM    | `ghcr.io/vroom-project/vroom-docker:v1.15.0`     |
| Proxy    | `caddy:2.8.4-alpine`                             |
| Health   | `node:22-alpine` (built from `health/`)          |

Bump the pins on purpose. Read the Valhalla and VROOM release notes before you do. `docker compose pull` then `docker compose up -d` restarts onto the pinned tags after you edit the compose file.

## What the app calls

- `POST /valhalla/sources_to_targets` with `costing: auto` and `units: miles`
- `POST /vroom/` with a custom `auto` duration and distance matrix

VROOM does not have to call Valhalla for this stop order, because the matrix is already in the request. Valhalla is still configured as VROOM's router for a later multi-vehicle pass.

There is no database migration for this engine.
