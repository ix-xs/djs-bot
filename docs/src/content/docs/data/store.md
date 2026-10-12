---
title: "Store"
description: "A small async key-value store for the state your bot must keep: balances, settings, tickets. It ships with an in-memory adapter and a SQLite adapter, and any other database plugs in with four functions."
sidebar:
  order: 1
---

The framework never imposes a database. It speaks one interface, `KVStore`, and
everything that needs persistence (your handlers, [feature flags](/data/flags/),
the [audit trail](/data/audit/)) goes through it. Swapping SQLite for Redis
later changes one line of configuration, not your handlers.

## A first store

Give `defineBot` a store. `sqliteStore` writes to a file, so the data survives
a restart.

```ts title="src/index.ts"
import { defineBot, env, sqliteStore } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./features",
  store: sqliteStore("data/bot.sqlite"),
});
```

The store is registered as the `store` service, already typed, so every handler
reaches it through `ctx.services.store`:

```ts title="features/economy/daily.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "daily",
  description: "Claim your daily coins",
  run: async (ctx) => {
    const coins = await ctx.services.store.increment(`coins:${ctx.user.id}`, 100);
    return ctx.reply.success(`You now have ${coins} coins.`);
  },
});
```

Events, triggers and jobs have the same `ctx.services.store`. Reading it when no
`store` is configured throws [`DJSBOT_E031`](/api/errors/#djsbot_e031), like any
unknown service.

## Reading and writing

Every method is async, and values must be JSON-serialisable (strings, numbers,
booleans, arrays, plain objects).

```ts
const store = ctx.services.store;

await store.set("motd", "Welcome");          // no expiry
await store.get("motd");                     // "Welcome", or undefined when absent
await store.has("motd");                     // true
await store.delete("motd");                  // true when something was removed
```

A third argument to `set` gives the key a time to live, as milliseconds or as a
duration string:

```ts
await store.set("code:1234", payload, "10m");   // duration string
await store.set("session", data, 30_000);       // milliseconds
await store.set("config", settings);            // no expiry
```

An expired key reads back as `undefined` and never shows up in `keys()`,
`entries()` or `size()`. Expired entries are also purged as new writes come in
(and when a SQLite store opens), so a key written with a TTL and never read
again does not stay in memory or on disk.

Two things to know about TTLs:

- Each write replaces the expiry. Writing a key again without a TTL makes it
  permanent, and that includes `increment` and `update`: pass the TTL on every
  call if the key must keep expiring.
- A duration string that cannot be parsed (`"soon"`) means no expiry, not an
  error. Months and years are not accepted, because their length varies: write
  `"90d"`.

`getOrSet` covers the usual "read it, or compute it and remember it" pattern:

```ts
const stats = await store.getOrSet(
  `stats:${ctx.guildId}`,
  () => expensiveAggregation(ctx.guildId),
  "5m",
);
```

Concurrent calls for the same key are de-duplicated per process: ten
simultaneous requests run the factory once and all await the same promise. If
the factory throws, nothing is stored and every waiting caller receives the
error.

## Counters and updates

Reading a value, changing it and writing it back in three steps loses updates
when two interactions arrive together. `increment` and `update` do the three
steps as one: calls for the same key are queued, so they run one after the
other.

```ts
const xp = store.namespace<number>("xp");

// Wrong: two commands at once both read 10 and both write 11.
const current = (await xp.get(ctx.user.id)) ?? 0;
await xp.set(ctx.user.id, current + 1);

// Right.
await xp.increment(ctx.user.id);

// Right, for anything richer than a number.
const profiles = store.namespace<{ xp: number; level: number }>("profiles");
await profiles.update(ctx.user.id, (profile = { xp: 0, level: 0 }) => ({
  ...profile,
  xp: profile.xp + 25,
}));
```

`increment` treats a missing key (or a value that is not a number) as `0`, and
accepts a negative number to subtract. `update` passes the current value, or
`undefined`, to your function, which may be async.

:::note[What "one step" covers]
The queue lives in the process, which is enough for every unsharded bot. When
several processes share one backend (shards on one Redis server), two of them
can still interleave. For a counter that must be exact there, call the
backend's own atomic operation (Redis `INCRBY`, for example) instead of
`increment`.
:::

## Namespaces and bulk access

`namespace(prefix)` returns a view of the same store where every key is stored
under `prefix:`. It needs no second backend, and it is also how you get typed
values: `ctx.services.store` holds `unknown`, a namespace holds what you say.

```ts
const tickets = store.namespace<{ open: boolean }>("tickets");
const economy = store.namespace<number>("economy");

await tickets.set("42", { open: true });   // stored as "tickets:42"
await economy.keys();                       // only economy keys, without the prefix
await tickets.clear();                      // only clears tickets
```

Namespaces nest (`store.namespace("guild").namespace(id)`), and the methods
that look at several keys only ever see the view you hold. A feature can list
or wipe its own data without touching anyone else's.

Namespaces are told apart exactly. Every character of a name is matched
literally, whatever it is, and so is its case: `namespace("Users")` and
`namespace("users")` are two different namespaces, with SQLite too.

```ts
const economy = ctx.services.store.namespace<number>("economy");

await economy.update(ctx.user.id, (coins = 0) => coins + 100);

// A leaderboard: every pair in one read, then sort.
const richest = (await economy.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

// Several keys at once. Missing keys are absent from the Map.
const balances = await economy.getMany([ctx.user.id, otherUserId]);

// Several writes sharing one optional TTL.
await economy.setMany({ [ctx.user.id]: 500, [otherUserId]: 250 });

await economy.size();   // how many live keys
```

With `sqliteStore`, `setMany()` is one transaction: all the keys are written or
none, and it is much faster than writing them one by one. `entries()` is one
query instead of one per key. With `memoryStore`, or with a backend that has no
bulk method of its own, the keys are written one after the other, so a write
that fails leaves the earlier ones in place.

## Choosing an adapter

| Adapter | Survives a restart | Use for |
| --- | --- | --- |
| `memoryStore()` | No | Tests, ephemeral state, bots that need no durability. |
| `sqliteStore(path)` | Yes | Most bots: one file, no server to run. |
| Your own, with `createStore` | Depends on the backend | Redis, Postgres, an HTTP API, shared state across shards. |

`sqliteStore` uses Node's built-in SQLite in WAL mode and creates the parent
directory for you. Everything lives in one table, `djsbot_kv` (`key`, `value`,
`expires`), so you can inspect the file with any SQLite client. Pass
`":memory:"` for a transient database that runs the same code path as
production, which makes it a good choice in tests:

```ts
const store = sqliteStore("data/bot.sqlite");
const test = sqliteStore(":memory:");
```

`memoryStore` keeps the object you gave it, not a copy: mutating a value after
`get` changes what is stored. `sqliteStore` serialises to JSON, so it returns a
fresh copy each time, and anything JSON cannot represent (a `Date`, a `Map`) is
lost or turned into a string.

To have more than one store, for example a durable one plus a fast ephemeral
one, register the extra one as a service with `defineStore`:

```ts title="features/cache.service.ts"
import { defineStore, memoryStore, type KVStore } from "@ix-xs/djs-bot";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap {
    cache: KVStore;
  }
}

export default defineStore("cache", memoryStore());
```

```ts
ctx.services.cache;   // the memory store
ctx.services.store;   // the one from defineBot({ store })
```

The `declare module` block is what types `ctx.services.cache`: see
[Services](/architecture/services/). On shutdown the framework closes the store
from `defineBot({ store })`. A store registered with `defineStore` is not closed
for you.

:::tip[A store is not a cache]
For hot in-process data with automatic eviction, use
[`createCache`](/data/cache/) instead: it is synchronous, bounded and can serve
stale values while it refreshes. That page compares the two.
:::

## Writing an adapter

Implement a `KVBackend` (four functions) and `createStore` derives the whole
`KVStore` from it: namespaces, single-flight `getOrSet`, counters, bulk reads.

```ts title="src/redis-store.ts"
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

Keys reach the backend fully prefixed, so it never has to know about
namespaces. The TTL arrives already converted to milliseconds, and `0` means
the key never expires. The backend is responsible for expiry: `get` must return
`undefined` for an expired key, and `keys` must leave it out.

Two optional functions speed up bulk access. `setMany(entries, ttlMs)` writes
several keys at once, as one step when the backend can (a transaction, a
pipeline). `entries(prefix)` returns every live `[key, value]` pair under
`prefix` in one go. Without them the store falls back on `set`, `keys` and
`get`.

A hand-written object that implements `KVStore` directly also works, including
one written before `increment`, `update`, `getMany`, `setMany`, `entries`,
`size` and `close` existed. When such an object reaches `defineBot({ store })`,
`defineStore`, `createFeatureFlags` or `storeAuditSink`, the framework detects
the missing methods and wraps it so they exist. For a new adapter,
`createStore` is less code.

## Reference

### `KVStore<V>`

The interface every store implements. `V` is the type of the values and
defaults to `unknown`. `ttl` is always optional: milliseconds, a duration
string such as `"10m"`, or nothing for no expiry.

| Method | Returns | Description |
| --- | --- | --- |
| `get(key)` | `Promise<V \| undefined>` | Reads a value. `undefined` when absent or expired. |
| `set(key, value, ttl?)` | `Promise<void>` | Writes a value and replaces its expiry. |
| `has(key)` | `Promise<boolean>` | Whether a live value exists. |
| `delete(key)` | `Promise<boolean>` | Deletes a key. `true` when something was removed. |
| `getOrSet(key, factory, ttl?)` | `Promise<V>` | Reads, or runs `factory` and stores the result on a miss. One factory call for concurrent readers. |
| `increment(key, by?, ttl?)` | `Promise<number>` | Adds `by` (default `1`) to a numeric key and returns the new value. A missing key counts as `0`. |
| `update(key, fn, ttl?)` | `Promise<V>` | Reads, transforms and writes back as one step. `fn` receives the current value or `undefined` and may be async. Returns the new value. |
| `getMany(keys)` | `Promise<Map<string, V>>` | Several keys at once. Missing keys are absent from the map. |
| `setMany(entries, ttl?)` | `Promise<void>` | Several writes sharing one TTL. Takes an object or an iterable of `[key, value]` pairs. One transaction with `sqliteStore`: all the keys are written or none. |
| `keys()` | `Promise<string[]>` | Every live key of this (namespaced) store, without the namespace prefix. |
| `entries()` | `Promise<[string, V][]>` | Every live `[key, value]` pair of this store. One query with `sqliteStore`. |
| `size()` | `Promise<number>` | How many live keys this store holds. |
| `clear()` | `Promise<void>` | Removes every key of this (namespaced) store. |
| `namespace<T>(prefix)` | `KVStore<T>` | A view scoped under `prefix:`. Synchronous. `T` defaults to `V`. |
| `close()` | `Promise<void>` | Releases the file handle or connection. Safe to call twice. Called for you on shutdown for the bot's store. |

### `memoryStore()`

```ts
memoryStore<V = unknown>(): KVStore<V>
```

An in-memory store. Zero setup, local to the process, lost on restart.
`close()` empties it.

### `sqliteStore(path)`

```ts
sqliteStore<V = unknown>(path?: string): KVStore<V>
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `path` | `string` | `"data/store.sqlite"` | The database file. The parent directory is created. `":memory:"` gives a transient database. |

### `createStore(backend)`

```ts
createStore<V = unknown>(backend: KVBackend): KVStore<V>
```

Builds a full `KVStore` from a `KVBackend`.

### `KVBackend`

The minimal contract a storage backend fulfils. Every function may be sync or
async.

| Method | Required | Description |
| --- | --- | --- |
| `get(key)` | Yes | The raw value, or `undefined` when absent or expired. |
| `set(key, value, ttlMs)` | Yes | Writes a value. `ttlMs` is `0` when the key never expires. |
| `delete(key)` | Yes | Deletes a key and reports whether something was removed. |
| `keys(prefix)` | Yes | Every live key that starts with `prefix` (`""` means all keys). |
| `clear(prefix)` | No | A fast path to delete every key under `prefix`. Without it, `clear()` falls back to `keys` then `delete`. |
| `setMany(entries, ttlMs)` | No | A fast path to write several keys at once, as one step when the backend can (a transaction, a pipeline). `entries` is a `ReadonlyArray<readonly [key: string, value: unknown]>`. Without it, `setMany()` falls back to `set`, one key at a time. |
| `entries(prefix)` | No | A fast path to return every live `[key, value]` pair under `prefix` in one go. Without it, `entries()` falls back to `keys` then `get`. |
| `close()` | No | Cleanup, called once by `store.close()`. |

### `defineStore(token, store)`

```ts
defineStore(token: string, store: KVStore): ServiceDefinition<KVStore>
```

Wraps a store as a service definition, so that a `*.service.ts` file can export
it and handlers read it as `ctx.services.<token>`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `token` | `string` | required | The service name. |
| `store` | `KVStore` | required | Any store: an adapter that ships with the framework or your own. |

## See also

- [Cache and entity resolution](/data/cache/): in-process caching, and how it differs from a store.
- [Feature flags](/data/flags/): reuse the bot's store, so toggles survive restarts.
- [Audit trail](/data/audit/): `storeAuditSink(store)` keeps the history in a store.
- [Services](/architecture/services/): how `ctx.services` is built and typed.
- [Configuration](/basics/configuration/): the `store` field of `defineBot`.
