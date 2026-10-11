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
| `GET /healthz` | always `200` | `{ status, uptimeMs }` | **Liveness** - the process is running. A failure here means "restart me". |
| `GET /readyz` | `200` / `503` | `{ ready }` | **Readiness** - the gateway is connected. `503` while starting or reconnecting. |
| `GET /metrics` | `200` | full status, JSON | Uptime, counters, latency and shard info. |
| `GET /metrics?format=prometheus` | `200` | Prometheus text | The same numbers, ready to scrape. Also served for `Accept: text/plain`. |
| anything else | `404` | `{ error }` | |

```bash
curl localhost:3000/healthz
# {"status":"ok","uptimeMs":128374}

curl localhost:3000/metrics
# {"ready":true,"uptimeMs":128374,
#  "metrics":{"interactions":842,"commands":611,"components":207,"modals":9,
#             "autocompletes":15,"guardRejections":12,"errors":3,
#             "handlerAvgMs":41.7,"handlerMaxMs":912.4,
#             "guilds":17,"wsPingMs":38,"memoryRssMb":142},
#  "shard":{"id":0,"count":2}}
```

:::note[Liveness vs readiness]
Use `/healthz` to decide whether to **restart** the container, and `/readyz` to
decide whether to **send it traffic**. Restarting a bot that is merely
reconnecting turns a blip into an outage.
:::

## Metrics

| Metric | Meaning |
| --- | --- |
| `interactions` | Interactions received, of every kind. |
| `commands` | Slash and context-menu commands routed to a handler. |
| `components` | Button and select interactions routed to a handler. |
| `modals` | Modal submissions routed to a handler. |
| `autocompletes` | Autocomplete requests answered. |
| `guardRejections` | Interactions refused by a guard. |
| `errors` | Handlers, events, triggers and jobs that threw. |
| `handlerAvgMs`, `handlerMaxMs` | Handler duration, guards and middleware included. |
| `guilds` | Guilds in this process's cache. |
| `wsPingMs` | Gateway heartbeat latency. |
| `memoryRssMb` | Resident memory of the process. |

The same counters are available in code through `bot.stats()`.

### Prometheus

```bash
curl "localhost:3000/metrics?format=prometheus"
# # TYPE djsbot_ready gauge
# djsbot_ready{shard="0"} 1
# # TYPE djsbot_interactions gauge
# djsbot_interactions{shard="0"} 842
# # TYPE djsbot_handler_avg_ms gauge
# djsbot_handler_avg_ms{shard="0"} 41.7
```

```yaml title="prometheus.yml"
scrape_configs:
  - job_name: discord-bot
    metrics_path: /metrics
    params: { format: [prometheus] }
    static_configs: [{ targets: ["bot:3000"] }]
```

Metric names are the JSON keys in snake case with a `djsbot_` prefix. On a
sharded bot each series carries a `shard` label. `toPrometheus(status)` is
exported if you serve metrics from your own HTTP server.

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
| `uptimeMs` | `number` | Milliseconds since the bot was created. |
| `metrics` | `Record<string, number>` | The counters above, and anything you add in standalone mode. |
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

`getStatus` is called **per request**, so the numbers are always current - never
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
