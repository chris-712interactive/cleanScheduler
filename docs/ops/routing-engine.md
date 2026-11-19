# Routing engine

The schedule orders one cleaner's stops with straight-line miles until a self-hosted engine is configured. Setup for a generic Ubuntu VPS, map extracts, and the health check are in `infra/routing/README.md`.

## App environment

Set these on the app only. Do not prefix them with `NEXT_PUBLIC_`. Leave them blank in development, CI, and hosted dev.

| Name                        | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| `ROUTING_ENGINE_URL`        | `https://` host of the Caddy proxy         |
| `ROUTING_ENGINE_TOKEN`      | Bearer token. Same value as the VPS `.env` |
| `ROUTING_ENGINE_TIMEOUT_MS` | Optional. 200–8000. Default 3000           |

`OUTBOUND_SUPPRESSED=1` skips the call and keeps the straight-line estimate. See `docs/ops/outbound-suppression.md`.

Recommended first VPS: 4 vCPU, 8 GB RAM, 40 GB disk, one US state extract. All-US tiles need a much larger machine. Details and the update steps are in the infra README.

No migration.
