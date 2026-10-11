---
title: "Scheduled jobs"
description: "A job runs your code on a schedule: every few minutes, or at a cron time in the timezone you choose. Each run gets its own logger, cannot overlap the previous one unless you allow it, and is told when the bot shuts down."
sidebar:
  order: 3
---

Use a job for work that no user asks for: a daily digest, a nightly cleanup, a
counter refreshed every ten minutes. You describe when it runs, and the
framework handles the timers, the overlap protection and the shutdown.

## A first job

```ts title="src/features/digest/digest.job.ts"
import { defineJob, env } from "@ix-xs/djs-bot";

export default defineJob({
  name: "daily-digest",
  schedule: "0 9 * * MON-FRI", // 09:00, Monday to Friday
  timezone: "Europe/Paris",
  run: async (ctx) => {
    const channel = await ctx.client.channels.fetch(env("DIGEST_CHANNEL_ID"));
    if (channel?.isSendable()) await channel.send("Good morning. Here is today's digest.");
    ctx.logger.info({}, "digest sent");
  },
});
```

The loader picks up any file whose name ends with `.job` (see
[Project layout](/basics/project-layout/)). Jobs start once the bot is connected
and ready, so `ctx.client` can be used straight away. `ctx` also holds your
`services`, a `logger` that tags every line with the job name and a
`correlationId` unique to the run, and a `signal` described
[below](#overlap-and-shutdown).

## Choose a schedule

`schedule` is a string in one of three syntaxes:

| Syntax | Examples | Runs |
| --- | --- | --- |
| A duration | `"30s"`, `"5m"`, `"1h"`, `"1d"` | Repeatedly, that long apart, counted from startup. |
| A cron expression, 5 fields | `"0 3 * * *"`, `"*/15 * * * *"`, `"0 9 * * MON-FRI"`, `"0 0 1 JAN,JUL *"` | At fixed clock times. |
| A macro | `"@hourly"`, `"@daily"`, `"@weekly"`, `"@monthly"`, `"@yearly"` | A named cron expression. |

Pick a duration when only the rhythm matters, and a cron expression when the
time of day matters. `"1h"` means one hour after the bot started, then every
hour. `"0 * * * *"` means at minute 0 of every hour.

The five cron fields are minute, hour, day of month, month and day of week:

```
"0 9 * * MON-FRI"
 | | | | |
 | | | | day of week   (0-7 or SUN-SAT)
 | | | month           (1-12 or JAN-DEC)
 | | day of month      (1-31)
 | hour                (0-23)
 minute                (0-59)
```

A cron expression is read in the local time of the machine that runs the bot,
unless you set `timezone` to an IANA zone name such as `"Europe/Paris"` or
`"UTC"`. Set it whenever the time of day matters to your users: a hosting
machine is often on UTC. `timezone` has no effect on a duration.

The full grammar is in the [reference](#schedule-syntax).

## Overlap and shutdown

By default a job never overlaps itself. If a run is still in progress when the
next one is due, that next run is skipped, not queued (the skip is logged at
debug level). Raise `concurrency` to allow several runs at once.

Every run also receives `ctx.signal`, an `AbortSignal` that fires when the bot
shuts down. A long job should check it between two steps, or hand it to
anything that accepts a signal, so that the bot can stop promptly:

```ts title="src/features/stats/member-counts.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "member-counts",
  schedule: "10m",
  run: async (ctx) => {
    for (const guild of ctx.client.guilds.cache.values()) {
      if (ctx.signal.aborted) return; // the bot is shutting down
      // "stats" is one of your own services
      await ctx.services.stats.record(guild.id, guild.memberCount);
    }
  },
});
```

On shutdown the timers stop, the signal is aborted, and the bot waits up to 10
seconds for the runs in progress before it goes on.

## Run at startup

A job first runs when its schedule says so: after one full interval for a
duration, at the next matching minute for a cron expression. Add
`runOnStart: true` to also run it once as soon as the bot is ready, for example
to fill a cache that a later run only refreshes.

```ts title="src/features/prices/refresh.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "refresh-prices",
  schedule: "15m",
  runOnStart: true,
  run: async (ctx) => {
    const response = await fetch("https://example.com/prices.json", { signal: ctx.signal });
    ctx.logger.info({ status: response.status }, "prices refreshed");
  },
});
```

## Jobs on a sharded bot

On a sharded bot, every shard is a separate process that runs your whole code,
jobs included. A job would therefore run once per shard. The `shard` option
decides whether that is what you want:

| `shard` | Runs on | Use it for |
| --- | --- | --- |
| `"all"` (default) | Every shard | Work on the guilds of the shard, such as a loop over `ctx.client.guilds.cache`. Each shard handles its own guilds, so nothing is done twice. |
| `"first"` | The shard that owns shard id 0 only | Work that must happen once for the whole bot: a daily announcement, a cleanup of shared data. |

```ts title="src/features/cleanup/cleanup.job.ts"
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "nightly-cleanup",
  schedule: "0 3 * * *",
  shard: "first", // once for the whole bot, not once per shard
  run: async (ctx) => {
    // "db" is one of your own services
    await ctx.services.db.purgeExpired();
    ctx.logger.info({}, "cleanup done");
  },
});
```

On a bot that is not sharded, both values behave the same. Everything else
about shards is on the [Sharding](/production/sharding/) page.

## Reference

### `defineJob(input)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | - | A unique name, used in logs and by `djs-bot explain`. |
| `schedule` | `string` | - | A duration, a 5-field cron expression or a macro. See [schedule syntax](#schedule-syntax). |
| `timezone` | `string` | host local time | IANA zone a cron expression is evaluated in, for example `"Europe/Paris"`. Ignored for a duration. |
| `concurrency` | `number` | `1` | How many runs may be active at once. A run that would exceed it is skipped. |
| `runOnStart` | `boolean` | `false` | Also run once when the bot is ready, in addition to the schedule. |
| `shard` | `"all" \| "first"` | `"all"` | On a sharded bot: every shard, or only the one that owns shard id 0. |
| `run` | `(ctx: JobContext) => unknown` | - | The work to do on each run. May be async. |

Returns a `JobDefinition` (`kind: "job"`), to export from a `.job` file or to
list in a [feature](/architecture/features/). The schedule is parsed when
`defineJob` is called.

### `JobContext`

| Property | Type | Description |
| --- | --- | --- |
| `client` | `Client<true>` | The connected client. |
| `services` | `ServiceMap` | Your [services](/architecture/services/), typed. |
| `logger` | `Logger` | A logger tagged with the job name and the `correlationId` of this run. |
| `signal` | `AbortSignal` | Aborted when the bot is shutting down. |
| `correlationId` | `string` | A unique id for this run. Every line logged through `logger` carries it. |

### Schedule syntax

**Durations.** A number followed by a unit, without spaces: `ms`, `s`, `m`, `h`,
`d` or `w`. Units can be combined (`"1h30m"`). A string made of digits only is a
number of milliseconds. Months and years are not accepted, and the duration must
be greater than zero.

**Cron expressions.** Exactly five fields separated by spaces:

| Field | Values | Names |
| --- | --- | --- |
| Minute | `0-59` | - |
| Hour | `0-23` | - |
| Day of month | `1-31` | - |
| Month | `1-12` | `JAN` to `DEC` |
| Day of week | `0-7` (`0` and `7` are Sunday) | `SUN` to `SAT` |

Each field accepts these forms. Names are not case sensitive.

| Form | Example | Meaning |
| --- | --- | --- |
| Any | `*` | Every value. |
| Value | `5`, `JAN` | That value only. |
| List | `1,15`, `JAN,JUL` | Each value of the list. An item can be any other form. |
| Range | `1-5`, `MON-FRI` | From the first to the last, both included. |
| Step | `*/10` | Every 10th value, starting from the lowest. |
| Start with step | `5/15` | From 5, every 15: `5`, `20`, `35`, `50`. |
| Range with step | `1-10/2` | `1`, `3`, `5`, `7`, `9`. |

A range must go upwards. `SAT-SUN` and `FRI-MON` are rejected because Sunday is
`0`: write `SAT,SUN` or `6-7`.

As in standard cron, when **both** the day of month and the day of week are
restricted, the job runs when either matches: `"0 0 1 * MON"` means the 1st of
the month, and every Monday.

**Macros.** Not case sensitive.

| Macro | Same as | Runs |
| --- | --- | --- |
| `@hourly` | `0 * * * *` | At minute 0 of every hour. |
| `@daily`, `@midnight` | `0 0 * * *` | Every day at midnight. |
| `@weekly` | `0 0 * * 0` | Every Sunday at midnight. |
| `@monthly` | `0 0 1 * *` | On the 1st of every month at midnight. |
| `@yearly`, `@annually` | `0 0 1 1 *` | On 1 January at midnight. |

### `parseSchedule(schedule)`

The parser used by `defineJob`, exported so you can validate a schedule that
comes from a configuration file or from a user.

```ts title="scripts/check-schedule.ts"
import { parseSchedule } from "@ix-xs/djs-bot";

parseSchedule("5m"); // { type: "interval", ms: 300000 }
parseSchedule("0 3 * * *"); // { type: "cron", fields: [...] }
parseSchedule("every day"); // throws an Error that says what is wrong
```

It returns a `ParsedSchedule`: `{ type: "interval", ms }` for a duration,
`{ type: "cron", fields }` for a cron expression or a macro.

## Limits and errors

- **An invalid schedule fails at once.** `defineJob` throws
  [`DJSBOT_E080`](/api/errors/#djsbot_e080) when the schedule cannot be parsed,
  so you find out at startup and not at 3 am. In an auto-discovered file, the
  loader reports it as [`DJSBOT_E060`](/api/errors/#djsbot_e060) with the name
  of the file and the reason.
- **An unknown `timezone` fails the same way.** `defineJob` throws
  [`DJSBOT_E080`](/api/errors/#djsbot_e080) with the detail
  `unknown timezone "X"` when the zone is not a known IANA name.
- **A job that throws does not stop the schedule.** The error is logged with the
  job name and its `correlationId`, then passed to every plugin `onError` hook
  and to the `onError` of `defineBot`, without a `ctx`. The next run happens as
  planned. See [Errors](/api/errors/).
- **Cron works to the minute.** A cron job fires at the top of the minute. There
  is no seconds field, and the extensions `?`, `L`, `W` and `#` are not
  supported. For anything shorter than a minute, use a duration.
- **Runs are not caught up.** Schedules live in memory. A run that was due while
  the bot was offline is not replayed, and a duration starts counting again at
  each startup.
- **Daylight saving time.** A cron time that does not exist on the day the
  clocks go forward is skipped that day, and one that occurs twice when they go
  back runs twice.
- **The concurrency limit is per process.** On a sharded bot with
  `shard: "all"`, each shard counts its own runs.

## See also

- [Sharding](/production/sharding/): what else changes when the bot runs on several shards.
- [Services](/architecture/services/): give a job access to a database or an API client.
- [Lifecycle](/basics/lifecycle/): when jobs start and what happens on shutdown.
- [Testing](/production/testing/): run a job once in a test, with fake services.
- [Logging](/production/logging/): follow a run through its `correlationId`.
