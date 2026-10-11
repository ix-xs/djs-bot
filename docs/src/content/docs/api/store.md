---
title: "Store (persistence)"
description: "KVStore: every method, counters and atomic updates, namespaces, TTLs, the two adapters and writing your own."
sidebar:
  order: 9
---

The framework never imposes a database. It speaks one small interface -
`KVStore` - and ships two adapters. Anything else (Redis, Postgres, a file, an
HTTP API) plugs in through [`createStore`](#writing-an-adapter).

```ts title="src/index.ts"
import { defineBot, sqliteStore } from "@ix-xs/djs-bot";

export default defineBot({
  store: sqliteStore("data/bot.sqlite"),
});
```

Configuring `store` registers it as the `store` service, already typed, so every
handler has it:

```ts
run: async (ctx) => {
  const coins = await ctx.services.store.increment(`coins:${ctx.user.id}`, 100);
  return ctx.reply.success(`You now have ${coins} coins.`);
}
```

## `KVStore` methods

Every method is async, and values are JSON-serialisable.

### Reading and writing

| Method | Returns | Description |
| --- | --- | --- |
| `get(key)` | `Promise<V \| undefined>` | Reads a value, or `undefined` when absent or expired. |
| `set(key, value, ttl?)` | `Promise<void>` | Writes a value. `ttl` accepts `"10m"`, milliseconds, or nothing for forever. |
| `has(key)` | `Promise<boolean>` | Whether a **fresh** value exists. |
| `delete(key)` | `Promise<boolean>` | Deletes a key; `true` when something was removed. |
| `getOrSet(key, factory, ttl?)` | `Promise<V>` | Reads, or computes and stores on a miss. |

### Counters and atomic updates

| Method | Returns | Description |
| --- | --- | --- |
| `increment(key, by = 1, ttl?)` | `Promise<number>` | Adds to a numeric key and returns the new value. A missing key counts as `0`; pass a negative number to subtract. |
| `update(key, fn, ttl?)` | `Promise<V>` | Reads, transforms and writes back as one step. `fn` gets the current value (or `undefined`) and may be async. |

Both are safe under concurrency: calls for the same key are queued, so two
interactions arriving together cannot overwrite each other.

```ts
// Wrong: two commands at once both read 10 and both write 11.
const xp = (await store.get(key)) ?? 0;
await store.set(key, xp + 1);

// Right.
await store.increment(key);

// Right, for anything richer than a number.
await store.update(`profile:${id}`, (profile = { xp: 0, level: 0 }) => ({
  ...profile,
  xp: profile.xp + 25,
}));
```

:::note[What "atomic" covers]
The guarantee holds within one process, which is every unsharded bot. Across
several processes sharing one backend (shards on Redis), use that backend's own
atomic operation in a custom adapter.
:::

### Bulk access

| Method | Returns | Description |
| --- | --- | --- |
| `getMany(keys)` | `Promise<Map<string, V>>` | Several keys at once. Missing keys are simply absent from the map. |
| `setMany(entries, ttl?)` | `Promise<void>` | Several writes sharing one optional TTL. Takes an object or an iterable of pairs. |
| `keys()` | `Promise<string[]>` | Every live key in this (namespaced) store, without the namespace prefix. |
| `entries()` | `Promise<[string, V][]>` | Every live `[key, value]` pair. |
| `size()` | `Promise<number>` | How many live keys. |
| `clear()` | `Promise<void>` | Removes every key in this (namespaced) store. |

```ts
const scores = store.namespace<number>("scores");
const top = (await scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
```

### Structure and lifecycle

| Method | Returns | Description |
| --- | --- | --- |
| `namespace(prefix)` | `KVStore<T>` | A view scoped under `prefix:`. |
| `close()` | `Promise<void>` | Releases the file handle or connection. Called for you on shutdown; safe to call twice. |

## TTLs

```ts
await store.set("code:1234", payload, "10m");   // duration string
await store.set("session", data, 30_000);       // milliseconds
await store.set("config", settings);            // no expiry
```

An expired key reads back as `undefined` and never shows up in `keys()`,
`entries()` or `size()`. Expired entries are also purged in the background, so a
key written with a TTL and never read again does not stay in memory or on disk.

## `getOrSet` - the cache-aside pattern

```ts
const stats = await store.getOrSet(
  `stats:${ctx.guildId}`,
  () => expensiveAggregation(ctx.guildId),
  "5m",
);
```

Concurrent calls for the same key are **de-duplicated per process**: ten
simultaneous requests run the factory once and all await the same promise.

## Namespaces

```ts
const tickets = store.namespace("tickets");
const economy = store.namespace("economy");

await tickets.set("42", { open: true });   // stored as "tickets:42"
await economy.keys();                       // only economy keys
await tickets.clear();                      // only clears tickets
```

Namespaces nest, and every bulk method is scoped to the view you hold - so a
feature can safely list or wipe its own data without touching anyone else's.
Prefix characters are escaped internally, so a namespace containing `%` or `_`
still matches literally.

Pass a type to get typed values: `store.namespace<Profile>("profiles")`.

## Adapters

### `memoryStore()`

```ts
memoryStore<V = unknown>(): KVStore<V>
```

Zero setup, process-local, lost on restart. Perfect for tests, ephemeral state
and bots that do not need durability.

### `sqliteStore(path?)`

```ts
sqliteStore<V = unknown>(path = "data/store.sqlite"): KVStore<V>
```

Durable, file-backed, no server to run - backed by Node's built-in SQLite, in
WAL mode. The parent directory is created for you. Pass `":memory:"` for a
transient database with the same code path as production.

```ts
const store = sqliteStore("data/bot.sqlite");
const test = sqliteStore(":memory:");
```

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

Implement a `KVBackend` - four methods - and `createStore` derives the whole
`KVStore` from it: namespaces, `getOrSet` single-flight, counters, bulk reads.

```ts
import { createStore, type KVStore } from "@ix-xs/djs-bot";
import { createClient } from "redis";

export function redisStore<V = unknown>(url: string): KVStore<V> {
  const client = createClient({ url });
  const ready = client.connect();

  return createStore<V>({
    async get(key) {
      await ready;
      const raw = await client.get(key);
      return raw === null ? undefined : JSON.parse(raw);
    },
    async set(key, value, ttlMs) {
      await ready;
      await client.set(key, JSON.stringify(value), ttlMs ? { PX: ttlMs } : undefined);
    },
    async delete(key) {
      await ready;
      return (await client.del(key)) > 0;
    },
    async keys(prefix) {
      await ready;
      return client.keys(`${prefix}*`);
    },
    close: () => client.quit(),
  });
}
```

| `KVBackend` method | Required | Description |
| --- | --- | --- |
| `get(key)` | yes | The raw value, or `undefined` when absent or expired. |
| `set(key, value, ttlMs)` | yes | `ttlMs` is `0` when the key never expires. |
| `delete(key)` | yes | Whether something was removed. |
| `keys(prefix)` | yes | Every live key starting with `prefix` (`""` for all). |
| `clear(prefix)` | no | A fast path to drop a whole prefix. Falls back to `keys` + `delete`. |
| `close()` | no | Cleanup, called by `store.close()`. |

Keys reach the backend fully prefixed, so it never has to know about
namespaces.

:::note[Adapters written for 1.0]
A hand-written `KVStore` from before these methods existed keeps working: the
framework wraps it at startup so `increment`, `update`, `entries` and the rest
are available. For new adapters, `createStore` is less code.
:::

## Where the store is used

Several framework features accept a `KVStore`, so one adapter covers them all:

| Feature | How |
| --- | --- |
| [Feature flags](/api/flags/) | `flags: { defaults }` reuses the bot's store, so toggles survive restarts |
| [Audit trail](/api/audit/) | `storeAuditSink(store)` |
| Your own features | `ctx.services.store` |

:::tip[A store is not a cache]
For hot in-process data with automatic eviction, reach for
[`createCache`](/api/cache/) instead - it is synchronous, bounded and
supports stale-while-revalidate.
:::
