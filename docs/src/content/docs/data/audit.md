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
A sink whose `record` throws or rejects never breaks the command that recorded
the entry: the other sinks still receive it, and the error is discarded.
Nothing is logged about the failure, so pair a fragile sink with
`loggerAuditSink()` to be sure the entry lands somewhere.
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

Every option, property and type, with what it accepts and returns, is in the API reference:

- `defineBot()`: Creates a `Bot`.
- `AuditSink`: A destination audit entries are written to.
- `memoryAuditSink()`: An in-memory sink (bounded ring buffer).
- `AuditEntry`: A single audit record.
- `timestamp()`: Renders a Discord timestamp (auto-localised in each user's client).
- `storeAuditSink()`: A sink that persists entries in a `KVStore` (one key per entry).
- `KVStore`: An async key-value store.
- `loggerAuditSink()`: A sink that writes each entry to the structured logger.
- `Logger`: Structured logger with level filtering and child bindings.
- `createLogger()`: Creates a root `Logger`.
- `AuditLog`: A configured audit log.
- `createAuditLog()`: Creates an `AuditLog`.
- `AuditFilter`: Filter for `AuditLog.query`.
- `AuditLogOptions`: Options for `createAuditLog`.

## See also

- [Store](/data/store/): the backend of `storeAuditSink`.
- [Logging](/production/logging/): where `loggerAuditSink` writes.
- [The ctx object](/basics/context/): the other helpers next to `ctx.audit`.
- [Feature flags](/data/flags/): an admin command that audits each toggle.
- [Testing](/production/testing/): in the test harness, `ctx.audit` does nothing.
