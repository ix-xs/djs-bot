---
title: "Presence"
description: "Choose the status dot and the activity line shown under your bot's name: set it once in the configuration, rotate between several, or change it while the bot is running."
sidebar:
  order: 6
---

The presence is what members see on the bot's profile and in the member list: a
status (online, idle, do not disturb, invisible) and an activity such as
"Listening to /help". It is a cheap way to tell people how to start, or that the
bot is under maintenance.

## A first presence

Set `presence` in `defineBot`. It is sent while the bot connects, so the bot
never appears without it.

```ts title="src/index.ts"
import { defineBot, env, ActivityType } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  presence: {
    status: "online",
    activities: [{ name: "/help", type: ActivityType.Listening }],
  },
});
```

Members now see "Listening to /help" under the bot's name. Without a `type`, an
activity is shown as "Playing".

## Rotating presences

`presenceRotation` cycles through a list of presences on a fixed interval.

```ts title="src/index.ts"
import { defineBot, env, ActivityType } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  presenceRotation: {
    interval: "30s",
    items: [
      { status: "online", activities: [{ name: "/help", type: ActivityType.Listening }] },
      { status: "online", activities: [{ name: "over 12 servers", type: ActivityType.Watching }] },
      { status: "idle", activities: [{ name: "maintenance", type: ActivityType.Playing }] },
    ],
  },
});
```

The rotation starts when the bot is ready. The first item is applied at once,
then the next one after each interval, in order, and the list starts over when
it reaches the end. `interval` is a duration string such as `"30s"`, `"5m"` or
`"1h30m"`, or a number of milliseconds. The rotation stops on shutdown.

Because the first item is applied as soon as the bot is ready, it replaces
`presence`. Setting both only makes sense when you want something specific
shown during the few moments before the bot is ready.

:::caution[Set the status on every item]
An item without a `status` keeps the status the bot already has. In the example
above, if the first two items did not say `"online"`, the bot would turn idle
at the third item and stay idle from then on. The same goes for an item without
`activities`: the current activity stays.
:::

## Changing it at runtime

The bot instance has two methods. Both need a connected bot.

```ts
// One activity, with an optional type and status:
bot.setActivity("with fire", { type: ActivityType.Playing, status: "dnd" });

// The full presence:
bot.setPresence({ status: "online", activities: [{ name: "you", type: ActivityType.Watching }] });
```

Handlers do not receive the bot instance. They receive the discord.js client as
`ctx.client`, and `ctx.client.user.setPresence(...)` is exactly what
`bot.setPresence` calls.

```ts title="features/admin/maintenance.command.ts"
import { defineCommand, ownerOnly, ActivityType } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "maintenance",
  description: "Show the bot as under maintenance",
  guards: [ownerOnly()],
  run: async (ctx) => {
    ctx.client.user.setPresence({
      status: "dnd",
      activities: [{ name: "maintenance", type: ActivityType.Playing }],
    });
    await ctx.reply.success("Presence updated.");
  },
});
```

The items of a rotation are fixed when the bot is configured. For text that
changes, such as a live server count, update the presence from a
[scheduled job](/events/jobs/) instead:

```ts title="features/presence/server-count.job.ts"
import { defineJob, ActivityType } from "@ix-xs/djs-bot";

export default defineJob({
  name: "server-count",
  schedule: "10m",
  runOnStart: true,
  run: (ctx) => {
    const count = ctx.client.guilds.cache.size;
    ctx.client.user.setActivity(`${count} servers`, { type: ActivityType.Watching });
  },
});
```

:::caution[A rotation overwrites manual changes]
The rotation does not know about presences you set yourself: its next tick
replaces them. Use either `presenceRotation` or runtime changes, not both.
:::

## Activity types and status

`ActivityType` is re-exported from discord.js. The type decides the words shown
before the name.

| Type | Shown as |
| --- | --- |
| `ActivityType.Playing` | Playing **name** (the default) |
| `ActivityType.Streaming` | Streaming **name**. Needs a `url` on Twitch or YouTube. |
| `ActivityType.Listening` | Listening to **name** |
| `ActivityType.Watching` | Watching **name** |
| `ActivityType.Competing` | Competing in **name** |
| `ActivityType.Custom` | **name** on its own, with no prefix |

The status is the coloured dot:

| Status | Meaning |
| --- | --- |
| `"online"` | Green dot. The default. |
| `"idle"` | Yellow moon. |
| `"dnd"` | Red "do not disturb" sign. |
| `"invisible"` | Shown as offline, while the bot keeps working. |

## Reference

### `presence`

```ts
presence?: PresenceData
```

The presence the bot connects with. Default: online, no activity. When it is
not set, a `presence` given in the `client` option of `defineBot` is used
instead.

### `presenceRotation`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `interval` | `string \| number` | required | How long each presence stays: a duration string or milliseconds. A string that cannot be read as a duration falls back to 60 seconds. |
| `items` | `PresenceData[]` | required | The presences to cycle through, in order. An empty list disables the rotation. |

### `PresenceData`

The discord.js type used by every option and method on this page.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `status` | `"online" \| "idle" \| "dnd" \| "invisible"` | the current status | The status dot. |
| `activities` | `{ name, type?, state?, url? }[]` | the current activities | What the bot is doing. An empty array clears the activity. |
| `afk` | `boolean` | `false` | Marks the bot as away from keyboard. |
| `shardId` | `number \| number[]` | every shard | Limits the change to some shards of this process. |

In an activity, `name` is required, `type` is an `ActivityType`, `url` is the
stream link for `Streaming`, and `state` is the text of a `Custom` activity
(when it is left out, `name` is used).

### `bot.setPresence(presence)`

```ts
bot.setPresence(presence: PresenceData): void
```

Replaces the presence. Fields left out keep their current value, as described
above.

### `bot.setActivity(name, options?)`

```ts
bot.setActivity(name: string, options?: { type?: ActivityType; url?: string; status?: PresenceStatusData }): void
```

A shortcut for a presence with exactly one activity.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | `ActivityType` | `ActivityType.Playing` | The words shown before the name. |
| `url` | `string` | none | A Twitch or YouTube URL, for `ActivityType.Streaming`. |
| `status` | `"online" \| "idle" \| "dnd" \| "invisible"` | the current status | The status dot. |

## Limits and errors

- `bot.setPresence` and `bot.setActivity` throw
  `Bot has not started yet - call bot.start() first.` when called before
  `bot.start()`. Call them from code that runs once the bot is ready: a handler,
  an event, a job.
- Every change is a message on the gateway connection, and Discord rate-limits
  those. An interval of tens of seconds is plenty for a rotation; do not go
  below a few seconds.
- On a [sharded](/production/sharding/) bot, each shard runs its own rotation
  and sets its own presence. The manager process never connects, so the two
  `bot` methods are not usable there.
- Seeing the presence of other members is a different subject: it needs the
  privileged `GuildPresences` intent, covered in
  [Events and intents](/events/events-and-intents/). Setting the bot's own
  presence needs no intent.

## See also

- [Configuration](/basics/configuration/) for the other `defineBot` options.
- [Scheduled jobs](/events/jobs/) for updating the presence on a schedule.
- [Lifecycle](/basics/lifecycle/) for what runs when the bot becomes ready.
- [Sharding](/production/sharding/) for running several processes.
