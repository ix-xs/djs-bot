---
title: "Health and metrics"
description: "A small HTTP server that tells an orchestrator, an uptime monitor or a dashboard whether your bot is alive, whether it is connected to Discord, and how much work it is doing."
sidebar:
  order: 3
---

The health server is built into the framework and has no dependency. It answers
three routes: one for liveness, one for readiness and one for metrics, in JSON
or in the Prometheus text format.

## Turning it on

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  health: 3000,
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

A number is the port. To choose the interface too, pass an object:

```ts
health: { port: env.number("PORT", 3000), host: "127.0.0.1" },
```

The server starts when the bot becomes ready and logs `Health server listening`.
It is closed by `bot.shutdown()`, and it never keeps the process alive on its
own.

A port that is already taken does not crash the bot. Health is not essential,
so the failure is logged as `Health server failed to start`, passed to
`health.onError` when you set one, and the bot keeps running without it.

## Endpoints

| Route | Status | Body | Meaning |
| --- | --- | --- | --- |
| `GET /healthz` | always `200` | `{ status, uptimeMs }` | Liveness: the process is running and answers. |
| `GET /readyz` | `200` or `503` | `{ ready }` | Readiness: `200` while the gateway connection is ready, `503` otherwise. |
| `GET /metrics` | `200` | the full status, JSON | Uptime, counters, latency, and the shard when sharded. |
| `GET /metrics?format=prometheus` | `200` | Prometheus text | The same numbers, ready to scrape. Also served when the `Accept` header starts with `text/plain`. |
| anything else | `404` | `{ error }` | |

```bash
curl localhost:3000/healthz
# {"status":"ok","uptimeMs":128374}

curl localhost:3000/readyz
# {"ready":true}
```

:::note[Liveness is not readiness]
Use `/healthz` to decide whether to restart the process, and `/readyz` to
decide whether the bot is serving. Restarting a bot that is only reconnecting
turns a blip into an outage.
:::

## Metrics

```jsonc
// GET /metrics
{
  "ready": true,
  "uptimeMs": 84213,
  "metrics": {
    "interactions": 1240, "commands": 830, "components": 390, "modals": 20,
    "autocompletes": 64, "guardRejections": 12, "errors": 3,
    "handlerAvgMs": 41.7, "handlerMaxMs": 912.4,
    "guilds": 57, "wsPingMs": 38, "memoryRssMb": 142
  },
  "shard": { "id": 0, "count": 4 }
}
```

| Metric | Meaning |
| --- | --- |
| `interactions` | Interactions received, of every kind. |
| `commands` | Slash and context-menu commands routed to a handler. |
| `components` | Button and select-menu interactions routed to a handler. |
| `modals` | Modal submissions routed to a handler. |
| `autocompletes` | Autocomplete requests answered by a handler. |
| `guardRejections` | Interactions refused by a guard. |
| `errors` | Handlers, events, triggers, jobs and hooks that threw. |
| `handlerAvgMs` | Average duration of an interaction, guards and middleware included. |
| `handlerMaxMs` | The slowest one seen. |
| `guilds` | Guilds in the cache of this process. |
| `wsPingMs` | Gateway heartbeat latency. `0` until the first heartbeat. |
| `memoryRssMb` | Resident memory of the process. |

Every value is computed when the request arrives, and the counters start again
from zero when the process restarts. `shard` is present only on a
[sharded](/production/sharding/) bot, where each shard reports about itself.

The counters and the two durations are also available in code, without the
server, through `bot.stats()`:

```ts
const stats = bot.stats();
bot.logger.info({ errors: stats.errors, avgMs: stats.handlerAvgMs }, "Hourly report");
```

`guilds`, `wsPingMs` and `memoryRssMb` are added by the health server and are
not part of `bot.stats()`.

## Prometheus

```bash
curl "localhost:3000/metrics?format=prometheus"
# # TYPE djsbot_ready gauge
# djsbot_ready{shard="0"} 1
# # TYPE djsbot_uptime_ms gauge
# djsbot_uptime_ms{shard="0"} 128374
# # TYPE djsbot_interactions gauge
# djsbot_interactions{shard="0"} 842
# # TYPE djsbot_handler_avg_ms gauge
# djsbot_handler_avg_ms{shard="0"} 41.7
```

A metric name is the JSON key in snake case with a `djsbot_` prefix:
`handlerAvgMs` becomes `djsbot_handler_avg_ms`. Two series come first,
`djsbot_ready` (`1` or `0`) and `djsbot_uptime_ms`. Every series is declared as
a gauge, and carries a `shard` label on a sharded bot (no label otherwise).

```yaml title="prometheus.yml"
scrape_configs:
  - job_name: discord-bot
    metrics_path: /metrics
    params: { format: [prometheus] }
    static_configs: [{ targets: ["bot:3000"] }]
```

## Probes and monitoring

The server starts when the bot is ready for the first time. Until then the port
is closed, so a probe is refused. Give the probes a start delay that covers the
login.

```yaml title="deployment.yaml"
livenessProbe:
  httpGet: { path: /healthz, port: 3000 }
  initialDelaySeconds: 20
  periodSeconds: 30
readinessProbe:
  httpGet: { path: /readyz, port: 3000 }
  periodSeconds: 10
```

For Docker, the `HEALTHCHECK` line and the rest of the container setup are in
the [Hosting](/recipes/hosting/) recipe.

For an uptime monitor (UptimeRobot, Better Stack, a cron job with `curl`), point
it at `/readyz`: it turns red when the bot is not answering Discord, which is
what your users experience.

:::caution[Do not expose it publicly]
`/metrics` reveals guild counts and internals, and the server has no
authentication. Bind it to a private interface with `host`, or keep it behind
your firewall or reverse proxy.
:::

## A standalone server

`startHealthServer` runs the same server outside `defineBot`: for a worker
process, or to publish your own counters. You provide a function that returns
the status. It is called on every request, so the numbers are always current.

```ts title="src/worker.ts"
import { startHealthServer } from "@ix-xs/djs-bot";

const started = Date.now();
let processed = 0;

const server = startHealthServer(
  () => ({
    ready: true,
    uptimeMs: Date.now() - started,
    metrics: { processed },
  }),
  {
    port: 3000,
    host: "127.0.0.1",
    onError: (error) => console.error("health server:", error.message),
  },
);

// Later, to stop it:
server.close();
```

If you already run an HTTP server, keep it and use `toPrometheus` to render the
text yourself. Here the bot's counters are published together with one of your
own:

```ts title="src/metrics.ts"
import { toPrometheus } from "@ix-xs/djs-bot";
import bot from "./index.js";
import { queue } from "./queue.js";

export function metricsText(): string {
  const { uptimeMs, ...counters } = bot.stats();
  return toPrometheus({
    ready: bot.client.isReady(),
    uptimeMs,
    metrics: { ...counters, queueSize: queue.size },
  });
}
```

## Reference

### `health`

The `health` field of [`defineBot`](/basics/configuration/): a port number, or
`HealthOptions`. Omit it and no server is started.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `port` | `number` | `3000` | Port to listen on. |
| `host` | `string` | all interfaces | Interface to bind. |
| `onError` | `(error: Error) => void` | writes to stderr | Called when the server cannot bind. Inside `defineBot`, the bot logs the failure first, then calls it. |

### `startHealthServer(getStatus, options)`

Starts the server and returns the Node `http.Server`. `getStatus` is a function
that returns a [`HealthStatus`](/production/health/#healthstatus) and is called
once per request. `options` is the `HealthOptions` table above and may be
omitted. The server does not keep the process alive, and a bind failure goes to
`onError` instead of throwing.

### `HealthStatus`

The shape returned by `/metrics`, and the argument of `toPrometheus`.

| Field | Type | Description |
| --- | --- | --- |
| `ready` | `boolean` | Whether the bot is connected and ready. Drives `/readyz`. |
| `uptimeMs` | `number` | Milliseconds of uptime. With `defineBot`, counted from the creation of the bot. |
| `metrics` | `Record<string, number>` | The counters. Any key you add in standalone mode is exported too. |
| `shard` | `{ id: number; count: number }?` | The shard, when sharded. |

### `toPrometheus(status)`

Renders a `HealthStatus` as the Prometheus text exposition format and returns
the string. Serve it with the content type
`text/plain; version=0.0.4; charset=utf-8`.

### `bot.stats()`

Returns a `BotStats` snapshot. It works before the bot has started, with every
counter at zero.

| Field | Type | Description |
| --- | --- | --- |
| `uptimeMs` | `number` | Milliseconds since this process created the bot. |
| `interactions` | `number` | Interactions received, of every kind. |
| `commands` | `number` | Slash and context-menu commands routed to a handler. |
| `components` | `number` | Button and select-menu interactions routed to a handler. |
| `modals` | `number` | Modal submissions routed to a handler. |
| `autocompletes` | `number` | Autocomplete requests answered. |
| `guardRejections` | `number` | Interactions refused by a guard. |
| `errors` | `number` | Handlers, events, triggers, jobs and hooks that threw. |
| `handlerAvgMs` | `number` | Average handler duration in milliseconds, rounded to two decimals. |
| `handlerMaxMs` | `number` | Slowest handler seen, in milliseconds. |

## See also

- [Hosting](/recipes/hosting/): Docker, systemd and pm2 setups that use these endpoints.
- [Sharding](/production/sharding/): one health server per shard, and how to give each a port.
- [Logging](/production/logging/): the other half of knowing what the bot is doing.
- [Errors](/api/errors/): what feeds the `errors` counter.
