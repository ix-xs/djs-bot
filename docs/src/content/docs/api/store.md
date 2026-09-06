---
title: "Store (persistence)"
description: "KVStore: every method, memoryStore, sqliteStore, namespaces, TTLs and custom adapters."
sidebar:
  order: 9
---

The framework never imposes a database. It speaks one small interface -
`KVStore` - and ships two adapters. Anything that implements the interface (Redis,
Postgres, a file, an HTTP API) drops straight in.

```ts title="src/index.ts"
import { defineBot, sqliteStore } from "@ix-xs/djs-bot";

export default defineBot({
  store: sqliteStore("data/bot.sqlite"),
});
```

Configuring `store` registers it as the `store` service, so every handler has it:

```ts
run: async (ctx) => {
  await ctx.services.store.set(`profile:${ctx.user.id}`, { xp: 10 });
  const profile = await ctx.services.store.get(`profile:${ctx.user.id}`);
}
```

## `KVStore` methods

Every method is async, and values are JSON-serialisable.

| Method | Returns | Description |
| --- | --- | --- |
| `get(key)` | `Promise<V \| undefined>` | Reads a value, or `undefined` when absent or expired. |
| `set(key, value, ttl?)` | `Promise<void>` | Writes a value. `ttl` accepts `"10m"`, milliseconds, or nothing for forever. |
| `has(key)` | `Promise<boolean>` | Whether a **fresh** value exists. |
| `delete(key)` | `Promise<boolean>` | Deletes a key; `true` when something was removed. |
| `keys()` | `Promise<string[]>` | Every key in this (namespaced) store, without the namespace prefix. |
| `clear()` | `Promise<void>` | Removes every key in this (namespaced) store. |
| `namespace(prefix)` | `KVStore<T>` | A view scoped under `prefix:`. |
| `getOrSet(key, factory, ttl?)` | `Promise<V>` | Reads, or computes and stores on a miss. |

### TTLs

```ts
await store.set("code:1234", payload, "10m");   // duration string
await store.set("session", data, 30_000);       // milliseconds
await store.set("config", settings);            // no expiry
```

An expired key reads back as `undefined` and is removed lazily on access.

### `getOrSet` - the cache-aside pattern

```ts
const stats = await store.getOrSet(
  `stats:${ctx.guildId}`,
  () => expensiveAggregation(ctx.guildId),
  "5m",
);
```

Concurrent calls for the same key are **de-duplicated per process**: ten
simultaneous requests run the factory once and all await the same promise.

### `namespace` - keeping keys apart

```ts
const tickets = store.namespace("tickets");
const economy = store.namespace("economy");

await tickets.set("42", { open: true });   // stored as "tickets:42"
await economy.keys();                       // only economy keys
await tickets.clear();                      // only clears tickets
```

Namespaces nest, and `keys()`/`clear()` are always scoped to the view you hold -
so a feature can safely wipe its own data without touching anyone else. Prefix
characters are escaped internally, so a namespace containing `%` or `_` still
matches literally.

## Adapters

### `memoryStore()`

```ts
memoryStore<V = unknown>(): KVStore<V>
```

Zero setup, process-local, lost on restart. Perfect for tests, ephemeral state
and single-process bots that do not need durability.

### `sqliteStore(path?)`

```ts
sqliteStore<V = unknown>(path = "data/store.sqlite"): KVStore<V>
```

Durable, file-backed, no server to run - backed by Node built-in SQLite. Pass
`":memory:"` for a transient database with the same code path as production.

```ts
const store = sqliteStore("data/bot.sqlite");
const test = sqliteStore(":memory:");
```

:::note[Requires Node 22+]
`sqliteStore` uses `node:sqlite`, which is why the framework requires Node 22 or
newer. `memoryStore` has no such requirement.
:::

Keys live in a single `djsbot_kv` table (`key`, `value`, `expires`), so you can
inspect the database with any SQLite client.

## `defineStore`

Registers a store as a service under any token - useful when you want more than
one, for example a durable store plus a fast ephemeral one:

```ts title="features/cache.service.ts"
import { defineStore, memoryStore } from "@ix-xs/djs-bot";

export default defineStore("cache", memoryStore());
```

```ts
ctx.services.cache;   // the memory store
ctx.services.store;   // the one from defineBot({ store })
```

## Writing an adapter

Implement the eight methods and you are done. A Redis version:

```ts
import type { KVStore } from "@ix-xs/djs-bot";
import { createClient } from "redis";

export function redisStore<V = unknown>(url: string, prefix = ""): KVStore<V> {
  const client = createClient({ url });
  const k = (key: string) => prefix + key;

  return {
    async get(key) {
      const raw = await client.get(k(key));
      return raw ? (JSON.parse(raw) as V) : undefined;
    },
    async set(key, value, ttl) {
      const ms = typeof ttl === "number" ? ttl : undefined;
      await client.set(k(key), JSON.stringify(value), ms ? { PX: ms } : undefined);
    },
    async has(key) {
      return (await client.exists(k(key))) === 1;
    },
    async delete(key) {
      return (await client.del(k(key))) > 0;
    },
    async keys() {
      return (await client.keys(`${prefix}*`)).map((key) => key.slice(prefix.length));
    },
    async clear() {
      const keys = await client.keys(`${prefix}*`);
      if (keys.length) await client.del(keys);
    },
    namespace(nested) {
      return redisStore(url, `${prefix}${nested}:`);
    },
    async getOrSet(key, factory, ttl) {
      const existing = await this.get(key);
      if (existing !== undefined) return existing;
      const value = await factory();
      await this.set(key, value, ttl);
      return value;
    },
  };
}
```

## Where the store is used

Several framework features accept a `KVStore`, so one adapter covers them all:

| Feature | How |
| --- | --- |
| [Feature flags](/djs-bot/api/flags/) | `flags: { store }` - toggles survive restarts |
| [Audit trail](/djs-bot/api/audit/) | `storeAuditSink(store)` |
| Your own features | `ctx.services.store` |

:::tip[A store is not a cache]
For hot in-process data with automatic eviction, reach for
[`createCache`](/djs-bot/api/cache/) instead - it is synchronous, bounded and
supports stale-while-revalidate.
:::
