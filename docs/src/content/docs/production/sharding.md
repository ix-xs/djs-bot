---
title: "Sharding"
description: "Split a large bot across several gateway connections with one option. Your commands, events and services stay the same; this page covers what changes around them: jobs, deploys, health checks and anything kept in memory."
sidebar:
  order: 2
---

A shard is one gateway connection that serves a share of your guilds. Discord
requires sharding from 2,500 guilds, and you can turn it on earlier to spread
the load. The framework does the wiring: the process you launch becomes a
manager that starts one child per shard, and each child runs your bot as usual.

## Turning sharding on

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  sharding: "auto",
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

`"auto"` (or `true`) asks Discord how many shards the bot needs. To decide
yourself, pass an object:

```ts
sharding: { totalShards: 4, mode: "process", respawn: true },
```

Nothing else changes in your code. discord.js reads the shard assignment from
what the manager hands to each child, so a handler is the same sharded or not.

## What starts where

With `sharding` set, `bot.start()` behaves differently depending on who calls
it.

| Process | What `bot.start()` does |
| --- | --- |
| The one you launch (the manager) | Loads the bot, spawns the shards, then returns. It never connects to Discord, so `bot.client` throws there. |
| Each shard | Connects and runs the bot: handlers, events, jobs, health server. |

Three consequences are worth knowing:

- The manager starts each shard by running again the file the process was
  launched with, with the same Node flags (so a TypeScript loader such as `tsx`
  keeps working). That file must therefore call `bot.start()` itself. Keep the
  `if (!process.env.DJSBOT_CLI) void bot.start();` line at the end of your entry
  file.
- The manager loads your features and builds your services like any other
  process, it only skips the connection. A service that opens a database
  connection opens one in the manager too.
- The CLI commands that only inspect the bot (`deploy`, `clear`, `doctor`,
  `explain`) never spawn shards.

Run a sharded bot the way you run any other: `node dist/index.js` on your built
entry, or `npx djs-bot start`. The [Hosting](/recipes/hosting/) recipe covers
keeping that process alive. The manager logs `Spawned shard` for each child,
`Shard died` when one exits, and `All shards spawned` once they are all up.

## Data across shards

Each shard only knows its own guilds, and everything held in memory belongs to
one shard: the discord.js caches, a `memoryStore()`, the counters behind
`cooldown()` and `rateLimit()`, a `TTLCache`, the numbers of `bot.stats()`.
Anything that must be the same everywhere belongs in a database shared by the
shards.

To read a value from every shard, use the discord.js helper on `ctx.client.shard`.
It is `null` when the bot is not sharded, so keep a fallback:

```ts title="src/features/stats/stats.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "stats",
  description: "Global stats",
  run: async (ctx) => {
    const counts = await ctx.client.shard?.fetchClientValues("guilds.cache.size");
    const total =
      (counts as number[] | undefined)?.reduce((a, b) => a + b, 0) ?? ctx.client.guilds.cache.size;
    await ctx.reply.info(`Serving ${total} servers.`);
  },
});
```

Broadcasts work the same way, through `ctx.client.shard.broadcastEval(...)`.

## Jobs and deploys

Every shard runs your code, so a scheduled job would run once per shard. That
is right for work that walks the guilds of the shard, and wrong for something
that must happen once. The `shard` option of a job chooses:

| `shard` | Runs on | Use it for |
| --- | --- | --- |
| `"all"` (default) | Every shard | Work on each shard's own guilds |
| `"first"` | Only the shard that owns id 0 | A daily announcement, a backup, a single API call |

```ts title="src/features/digest/digest.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "daily-digest",
  schedule: "0 9 * * *",
  shard: "first",
  run: async (ctx) => {
    ctx.logger.info({}, "Posting the daily digest");
  },
});
```

On a bot that is not sharded both values behave the same: the job runs. The
other job options are on the [Scheduled jobs](/events/jobs/) page.

The automatic deploy at startup follows the same rule: only shard 0 deploys, so
the commands are registered once per start and not once per shard. Deploying
with `npx djs-bot deploy` is unaffected, since it never connects to the
gateway. See [Deploying commands](/production/deploying/).

## Health per shard

Each shard starts its own [health server](/production/health/) and reports
about itself only. The JSON of `/metrics` gains a `shard` field, here for the
third of four shards:

```json
"shard": { "id": 2, "count": 4 }
```

In the Prometheus format every series carries the label `shard="2"` instead, so
the shards can be told apart on a dashboard. The counters, and `guilds` in
particular, are those of that shard and not of the whole bot. The manager has no
health server, because it never connects.

:::caution[One port per shard]
All shards read the same configuration, so with `health: 3000` they all ask for
port 3000 on the same machine. The first one gets it. The others log
`Health server failed to start` and carry on without a health server.
:::

In `process` mode, discord.js gives each child its shard id in the `SHARDS`
environment variable, which is enough to spread the ports:

```ts
health: 3000 + Number(process.env.SHARDS ?? 0),   // shard 0 on 3000, shard 1 on 3001...
```

In `worker` mode the threads share one environment and that variable is not
set. The same value is available as `workerData.SHARDS` from
`node:worker_threads`.

## Reference

### `sharding`

The `sharding` field of [`defineBot`](/basics/configuration/).

| Value | Effect |
| --- | --- |
| omitted, `false` | No sharding: one process, one connection. |
| `true`, `"auto"` | Sharding with every default below. |
| `ShardingOptions` | Sharding with your settings. Omitted fields take their default. |

### `ShardingOptions`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `totalShards` | `number \| "auto"` | `"auto"` | How many shards to spawn. `"auto"` lets Discord decide. |
| `mode` | `"process" \| "worker"` | `"process"` | `"process"` forks one child process per shard. `"worker"` uses worker threads inside one process. |
| `respawn` | `boolean` | `true` | Start a shard again when it dies. |

### `normalizeSharding(input)`

Turns the loose `sharding` value (`true`, `"auto"` or partial options) into
complete `ShardingOptions` with the defaults above.

### `isShardChild()`

Returns `true` in a process or thread spawned by a shard manager, which should
run the bot, and `false` in the manager (and in a bot that is not sharded). Use
it to keep manager-only work out of the shards.

In the manager the answer stays `false`, before and after `bot.start()`.

```ts title="src/index.ts"
import { defineBot, env, isShardChild } from "@ix-xs/djs-bot";

const bot = defineBot({ token: env("DISCORD_TOKEN"), sharding: "auto" });

export default bot;

if (!process.env.DJSBOT_CLI) {
  if (!isShardChild()) bot.logger.info({}, "Starting the shard manager");
  await bot.start();
}
```

### `launchShardManager(entryFile, token, options, logger)`

What `bot.start()` calls in the manager. It creates a discord.js
`ShardingManager` for `entryFile`, passes the current Node flags to the
children, logs the life of each shard, and resolves with the manager once every
shard has been spawned. Call it yourself only when you write your own launcher.

| Parameter | Type | Description |
| --- | --- | --- |
| `entryFile` | `string` | The file each shard runs. `bot.start()` passes the file the process was launched with. |
| `token` | `string` | The bot token. |
| `options` | `ShardingOptions` | Shard count, mode and respawn. |
| `logger` | `Logger` | Receives the shard events. |

## See also

- [Scheduled jobs](/events/jobs/): every option of `defineJob`.
- [Health and metrics](/production/health/): the endpoints each shard exposes.
- [Deploying commands](/production/deploying/): how and when commands are registered.
- [Store](/data/store/): keeping state outside the memory of one shard.
- [Hosting](/recipes/hosting/): running the manager under systemd, Docker or pm2.
