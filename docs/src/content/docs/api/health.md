---
title: "Health checks & metrics"
description: "The /healthz, /readyz and /metrics endpoints, options, and wiring them to Docker or Kubernetes."
sidebar:
  order: 14
---

A tiny, dependency-free HTTP server so a container orchestrator, uptime monitor
or load balancer can tell whether your bot is alive and connected.

```ts title="src/index.ts"
export default defineBot({
  health: 3000,                      // shorthand
  // health: { port: 3000, host: "0.0.0.0" },
});
```

## Endpoints

| Route | Status | Body | Meaning |
| --- | --- | --- | --- |
| `GET /healthz` | always `200` | `{ status, uptimeMs }` | **Liveness** — the process is running. A failure here means "restart me". |
| `GET /readyz` | `200` / `503` | `{ ready }` | **Readiness** — the gateway is connected. `503` while starting or reconnecting. |
| `GET /metrics` | `200` | full status | Uptime, counters and shard info as JSON. |
| anything else | `404` | `{ error }` | |

```bash
curl localhost:3000/healthz
# {"status":"ok","uptimeMs":128374}

curl localhost:3000/metrics
# {"ready":true,"uptimeMs":128374,
#  "metrics":{"interactions":842,"errors":3,"guilds":17},
#  "shard":{"id":0,"count":2}}
```

:::note[Liveness vs readiness]
Use `/healthz` to decide whether to **restart** the container, and `/readyz` to
decide whether to **send it traffic**. Restarting a bot that is merely
reconnecting turns a blip into an outage.
:::

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `port` | `number` | `3000` | Port to listen on. |
| `host` | `string` | all interfaces | Interface to bind. |
| `onError` | `(error: Error) => void` | writes to stderr | Called if the server cannot bind. |

```ts
health: {
  port: Number(env("PORT", "3000")),
  host: "0.0.0.0",
  onError: (error) => logger.error({ err: error }, "health server failed to start"),
}
```

:::tip[A busy port never crashes the bot]
Health is non-essential, so a bind failure such as `EADDRINUSE` is reported
through `onError` (or stderr) and the bot keeps running. The server is also
`unref`-ed, so it never keeps the process alive on its own.
:::

## `HealthStatus`

The shape returned by `/metrics`:

| Field | Type | Description |
| --- | --- | --- |
| `ready` | `boolean` | Whether the gateway is connected. |
| `uptimeMs` | `number` | Milliseconds since the process started. |
| `metrics` | `Record<string, number>` | Counters — interactions, errors, guilds, and anything you add. |
| `shard` | `{ id, count }?` | Present when sharded. |

## Standalone

Run the same server outside the framework, or with your own counters:

```ts
import { startHealthServer } from "@ix-xs/djs-bot";

const started = Date.now();
const server = startHealthServer(
  () => ({
    ready: client.isReady(),
    uptimeMs: Date.now() - started,
    metrics: { queue: queue.size, cacheHits },
  }),
  { port: 3000 },
);

// later
server.close();
```

`getStatus` is called **per request**, so the numbers are always current — never
a snapshot captured at boot.

## Docker

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -qO- http://localhost:3000/healthz || exit 1
```

## Kubernetes

```yaml
livenessProbe:
  httpGet: { path: /healthz, port: 3000 }
  initialDelaySeconds: 20
  periodSeconds: 30
readinessProbe:
  httpGet: { path: /readyz, port: 3000 }
  periodSeconds: 10
```

## Uptime monitoring

Point any monitor (UptimeRobot, Better Stack, a cron with `curl`) at `/readyz`:
it turns red exactly when your bot is not answering Discord, which is what your
users actually experience.

:::caution[Do not expose it publicly]
`/metrics` reveals guild counts and internals. Bind it to a private interface,
or keep it behind your firewall or reverse proxy.
:::
