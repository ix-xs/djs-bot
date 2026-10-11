---
title: "Audit trail"
description: "Keep a structured, queryable record of who did what with ctx.audit. Entries go to one or more sinks (memory, a store, the logger), and every command use can be recorded for you."
sidebar:
  order: 5
---

Moderation bots need an audit trail, and every bot benefits from one the first
time someone asks "who banned that member?". This is the bot's own record, kept
where you decide. It is separate from the audit log Discord keeps for each
server.

## A first audit entry

Configure `audit` with at least one sink, the place entries are written to:

```ts title="src/index.ts"
import { defineBot, env, loggerAuditSink, sqliteStore, storeAuditSink } from "@ix-xs/djs-bot";

const store = sqliteStore("data/bot.sqlite");

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./features",
  store,
  audit: {
    sinks: [storeAuditSink(store, { ttl: "90d" }), loggerAuditSink()],
  },
});
```

Then call `ctx.audit` in a handler. The actor (the user behind the interaction)
and the guild are filled in for you, so a call stays short:

```ts title="features/moderation/ban.command.ts"
import { defineCommand, hasPermission, inGuild, PermissionFlagsBits, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ban",
  description: "Ban a member",
  guards: [inGuild(), hasPermission(PermissionFlagsBits.BanMembers)],
  options: {
    target: s.user({ description: "Who to ban", required: true }),
    reason: s.string({ description: "Why" }),
  },
  run: async (ctx) => {
    await ctx.guild!.members.ban(ctx.options.target, { reason: ctx.options.reason });
    await ctx.audit("member.ban", {
      targetId: ctx.options.target.id,
      metadata: { reason: ctx.options.reason },
    });
    return ctx.reply.success("Banned.");
  },
});
```

Configuring `audit` also registers the `audit` service, used to
[query the trail](#querying-the-trail). When `audit` is not configured,
`ctx.audit()` does nothing: handlers that call it never crash.

:::tip[Naming actions]
Use `domain.verb`: `member.ban`, `ticket.close`, `config.update`. The `action`
filter matches the exact name, so consistent names are what make queries and
log filtering useful.
:::

`ctx.audit` exists in interaction handlers. In an event, a trigger or a job
there is no interaction to read the actor from, so write through the service
and give the fields yourself:

```ts
await ctx.services.audit.record("member.join", {
  actorId: member.id,
  guildId: member.guild.id,
});
```

## Recording commands automatically

With `autoRecordCommands: true`, every slash command use is recorded as
`command:<name>`, with no code in your handlers:

```ts
audit: {
  sinks: [storeAuditSink(store)],
  autoRecordCommands: true,
},
```

What this records, exactly:

- Slash commands only. Context menus, buttons, select menus and modals are not
  recorded.
- The top-level command name. A subcommand is recorded under its parent
  (`command:config`, not `command:config set`).
- The actor and the guild. No target, no options, no metadata.
- The attempt, not the outcome: the entry is written before the guards run, so
  a refused or failed command is recorded too.

For anything richer, call `ctx.audit` yourself.

## Choosing sinks

A sink is where entries go. Give several and each entry is written to all of
them, for example one durable sink and one for live tailing.

| Sink | Durable | Queryable | Use for |
| --- | --- | --- | --- |
| `memoryAuditSink(max?)` | No | Yes | Tests, short-lived debugging. Keeps the latest 5000 entries by default. |
| `storeAuditSink(store, options?)` | With a durable store | Yes | Real history. One store key per entry. |
| `loggerAuditSink(logger?)` | Depends on your log pipeline | No | Shipping to Loki, Datadog or CloudWatch. |

Without any sink (`audit: {}`), entries go to a `memoryAuditSink()`.

`storeAuditSink` writes into a namespace of the [store](/data/store/), away
from your other keys, and a `ttl` is a retention policy in one option:

```ts
storeAuditSink(store, { namespace: "audit", ttl: "90d" })
```

`loggerAuditSink()` logs each entry at `info` level with the message
`audit: <action>` and the entry under the `audit` field. It takes an optional
[logger](/production/logging/) and otherwise creates its own, so it works
inline in the configuration.

Any object with a `record` function, and optionally a `query` function, is a
sink:

```ts title="src/webhook-sink.ts"
import type { AuditSink } from "@ix-xs/djs-bot";

export const webhookSink = (url: string): AuditSink => ({
  async record(entry) {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `\`${entry.action}\` by <@${entry.actorId}>` }),
    });
  },
});
```

:::note[Failures are contained, and silent]
A sink whose `record` rejects never breaks the command that recorded the entry:
the other sinks still receive it, and the error is discarded. Nothing is logged
about the failure, so pair a fragile sink with `loggerAuditSink()` to be sure
the entry lands somewhere. Declare a custom `record` as `async`, as above, so
that anything it throws is contained the same way.
:::

`ctx.audit` resolves once every sink has finished. A slow sink, such as a
webhook, therefore delays the handler that awaits it.

## Querying the trail

Read entries back through the `audit` service. It is already typed, so no cast
is needed.

```ts
const entries = await ctx.services.audit.query({
  action: "member.ban",
  guildId: ctx.guildId!,
  since: Date.now() - 7 * 24 * 3600_000,
  limit: 25,
});
```

Results come from the first sink that can be read, in the order you listed
them, newest first. A setup with only `loggerAuditSink()` returns an empty
array: include a memory or a store sink to query. If you list a memory sink
before a store sink, queries only see what is in memory.

A history command for moderators:

```ts title="features/admin/audit.command.ts"
import {
  defineCommand,
  hasPermission,
  inGuild,
  mention,
  PermissionFlagsBits,
  s,
  timestamp,
  TimestampStyles,
} from "@ix-xs/djs-bot";

export default defineCommand({
  name: "audit",
  description: "Recent moderation actions",
  guards: [inGuild(), hasPermission(PermissionFlagsBits.ViewAuditLog)],
  options: {
    action: s.string({ description: "Filter by action, e.g. member.ban" }),
    user: s.user({ description: "Filter by moderator" }),
  },
  run: async (ctx) => {
    const entries = await ctx.services.audit.query({
      guildId: ctx.guildId!,
      action: ctx.options.action,
      actorId: ctx.options.user?.id,
      limit: 10,
    });

    if (entries.length === 0) return ctx.reply.info("Nothing recorded yet.");

    return ctx.reply.info(
      entries
        .map((entry) => {
          const when = timestamp(entry.timestamp, TimestampStyles.RelativeTime);
          const who = entry.actorId ? mention.user(entry.actorId) : "unknown";
          return `${when}: \`${entry.action}\` by ${who}`;
        })
        .join("\n"),
    );
  },
});
```

A query loads every entry of the sink, then filters and sorts them in memory.
That is fine for thousands of entries. For a long history, set a `ttl` on
`storeAuditSink`, or write a sink whose `query` asks a real database.

## Audit without a bot

`createAuditLog` builds the same log on its own, for a script or a test:

```ts title="tests/audit.test.ts"
import { createAuditLog, memoryAuditSink } from "@ix-xs/djs-bot";

const audit = createAuditLog({ sinks: [memoryAuditSink()] });

const entry = await audit.record("member.ban", { actorId: "1", targetId: "2" });
entry.id;          // generated
entry.timestamp;   // Date.now()

await audit.query({ action: "member.ban" });   // [entry]
```

## Reference

### `audit` in `defineBot`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `sink` | `AuditSink` | none | A single destination. |
| `sinks` | `AuditSink[]` | none | Several destinations. All of them receive every entry. |
| `autoRecordCommands` | `boolean` | `false` | Record every slash command use as `command:<name>`. |

`sink` and `sinks` can be combined: `sink` comes first. With neither, a
`memoryAuditSink()` is used.

### `ctx.audit(action, details?)`

```ts
ctx.audit(action: string, details?: {
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `action` | `string` | required | What happened, for example `"member.ban"`. |
| `details.targetId` | `string` | none | The id of what the action was applied to: a user, a message, a channel. |
| `details.metadata` | `Record<string, unknown>` | none | Anything else worth keeping, for example `{ reason }`. |

`actorId` is the id of the user behind the interaction and `guildId` its guild
(`null` in a DM).

### `AuditEntry`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique id, generated for you. |
| `timestamp` | `number` | Unix milliseconds. |
| `action` | `string` | What happened, for example `"member.ban"` or `"command:ban"`. |
| `actorId` | `string?` | Who did it. |
| `targetId` | `string?` | Who or what it was done to. |
| `guildId` | `string \| null?` | Where. |
| `metadata` | `Record<string, unknown>?` | Any structured context. |

### `memoryAuditSink(max)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `max` | `number` | `5000` | How many entries are kept. Past that, the oldest is dropped. |

### `storeAuditSink(store, options)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `store` | `KVStore` | required | The store entries are written to, one key per entry (the entry id). |
| `options.namespace` | `string` | `"audit"` | The store namespace entries live under. |
| `options.ttl` | `number \| string` | none | How long an entry is kept, in milliseconds or as a duration such as `"90d"`. Forever by default. |

### `loggerAuditSink(logger)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `logger` | `Logger` | `createLogger()` | The logger entries are written to. Write-only: this sink cannot be queried. |

### `AuditSink`

| Method | Required | Description |
| --- | --- | --- |
| `record(entry)` | Yes | Stores one `AuditEntry`. May be async. |
| `query()` | No | Returns every stored entry, in any order. Its presence makes the sink readable by `AuditLog.query`. |

### `AuditLog`

The type of `ctx.services.audit` and of the value `createAuditLog` returns.

| Method | Returns | Description |
| --- | --- | --- |
| `record(action, data?)` | `Promise<AuditEntry>` | Writes an entry to every sink and returns it. `data` takes any `AuditEntry` field except `action`. `id` and `timestamp` are generated unless you pass them. |
| `query(filter?)` | `Promise<AuditEntry[]>` | Reads entries, newest first, from the first sink that has a `query` function. An empty array when none has. |

### `AuditFilter`

Every field is optional, and the fields combine with "and".

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `action` | `string` | any | Only entries with this exact action name. |
| `actorId` | `string` | any | Only entries triggered by this user id. |
| `guildId` | `string` | any | Only entries recorded in this guild. |
| `since` | `number` | none | Only entries at or after this time, in Unix milliseconds. |
| `limit` | `number` | no limit | The maximum number of entries, counted from the newest. |

### `createAuditLog(options)`

```ts
createAuditLog(options?: AuditLogOptions): AuditLog
```

`AuditLogOptions` has the `sink` and `sinks` fields described above.
`autoRecordCommands` belongs to `defineBot` only.

## See also

- [Store](/data/store/): the backend of `storeAuditSink`.
- [Logging](/production/logging/): where `loggerAuditSink` writes.
- [The ctx object](/basics/context/): the other helpers next to `ctx.audit`.
- [Feature flags](/data/flags/): an admin command that audits each toggle.
- [Testing](/production/testing/): in the test harness, `ctx.audit` does nothing.
