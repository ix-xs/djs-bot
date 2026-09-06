---
title: "Audit trail"
description: "ctx.audit, sinks, querying entries and automatic command recording."
sidebar:
  order: 12
---

An audit trail is a structured, queryable record of **who did what**. Moderation
bots need it; every bot benefits from it the first time someone asks "who deleted
that channel?".

```ts title="src/index.ts"
import { defineBot, sqliteStore, storeAuditSink, loggerAuditSink } from "@ix-xs/djs-bot";

const store = sqliteStore("data/bot.sqlite");

export default defineBot({
  store,
  audit: {
    sinks: [storeAuditSink(store, { ttl: "90d" }), loggerAuditSink()],
    autoRecordCommands: true,
  },
});
```

### Configuration

| Field | Type | Description |
| --- | --- | --- |
| `sink` | `AuditSink` | A single destination. |
| `sinks` | `AuditSink[]` | Several destinations — **all** receive every entry. |
| `autoRecordCommands` | `boolean` | Record every command use as `command:<name>`, with no code in your handlers. |

Configuring `audit` enables `ctx.audit(...)` and registers the `audit` service.

## `ctx.audit()`

```ts
ctx.audit(action: string, details?: {
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>
```

`actorId` and `guildId` are filled in from the interaction, so a call stays
short:

```ts
run: async (ctx) => {
  await ctx.guild!.members.ban(ctx.options.target);
  await ctx.audit("member.ban", {
    targetId: ctx.options.target.id,
    metadata: { reason: ctx.options.reason },
  });
  return ctx.reply.success("Banned.");
}
```

When audit is not configured, `ctx.audit()` is a no-op — never a crash.

:::tip[Naming actions]
Use `domain.verb`: `member.ban`, `ticket.close`, `config.update`. Consistent
names make `query({ action })` and log filtering actually useful.
:::

## `AuditEntry`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique id, generated for you. |
| `timestamp` | `number` | Unix milliseconds. |
| `action` | `string` | What happened. |
| `actorId` | `string?` | Who did it. |
| `targetId` | `string?` | Who or what it was done to. |
| `guildId` | `string \| null?` | Where. |
| `metadata` | `Record<string, unknown>?` | Any structured context. |

## Sinks

A sink is where entries go. Ship several at once — for example one durable and
one for live tailing.

| Sink | Durable | Queryable | Use for |
| --- | --- | --- | --- |
| `memoryAuditSink(max?)` | No | Yes | Tests, short-lived debugging. Ring buffer, default 5000 entries. |
| `storeAuditSink(store, opts?)` | Yes | Yes | Real history. One key per entry. |
| `loggerAuditSink(logger?)` | Depends on your log pipeline | No | Shipping to Loki/Datadog/CloudWatch. |

```ts
storeAuditSink(store, { namespace: "audit", ttl: "90d" })
```

| Option | Default | Description |
| --- | --- | --- |
| `namespace` | `"audit"` | Store namespace, keeping entries away from your other keys. |
| `ttl` | none | Auto-expire old entries — a simple retention policy. |

`loggerAuditSink()` takes an optional logger and otherwise creates its own, so
it works inline in the config.

### A custom sink

Any object with `record`, and optionally `query`, is a sink:

```ts
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

:::note[Failures are contained]
Sinks are written with `Promise.allSettled`: a broken sink can never break the
command that recorded the entry. Add `loggerAuditSink()` if you want those
failures visible.
:::

## Querying

Through the service:

```ts
const entries = await ctx.services.audit.query({
  action: "member.ban",
  guildId: ctx.guildId!,
  since: Date.now() - 7 * 24 * 3600_000,
  limit: 25,
});
```

| Filter | Type | Description |
| --- | --- | --- |
| `action` | `string` | Exact match. |
| `actorId` | `string` | Who did it. |
| `guildId` | `string` | Where. |
| `since` | `number` | Unix ms — entries at or after this time. |
| `limit` | `number` | Max entries, newest first. |

Results come from the **first read-capable sink**, newest first. A logger-only
setup returns an empty array — include a memory or store sink to query.

## A history command

```ts title="features/admin/audit.command.ts"
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
        .map((e) => `${timestamp(e.timestamp, TimestampStyles.RelativeTime)} — \`${e.action}\` by <@${e.actorId}>`)
        .join("\n"),
    );
  },
});
```

## Standalone

```ts
import { createAuditLog, memoryAuditSink } from "@ix-xs/djs-bot";

const audit = createAuditLog({ sinks: [memoryAuditSink()] });
await audit.record("member.ban", { actorId: "1", targetId: "2" });
await audit.query({ action: "member.ban" });
```

| Method | Description |
| --- | --- |
| `record(action, data?)` | Writes an entry (id and timestamp filled in) and returns it. |
| `query(filter?)` | Reads entries, newest first, from the first read-capable sink. |
