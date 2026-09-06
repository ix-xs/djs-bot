---
title: "Cache & entity resolution"
description: "TTLCache, stale-while-revalidate, and cache-first resolve helpers for Discord entities."
sidebar:
  order: 16
---

## `createCache()`

An in-process TTL + LRU cache. Synchronous reads, bounded size, optional
stale-while-revalidate.

```ts
import { createCache } from "@ix-xs/djs-bot";

const cache = createCache<string, Profile>({ ttl: "5m", max: 500 });
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ttl` | `number \| string` | `"5m"` | Time to live: ms or `"30s"`, `"5m"`, `"1h"`. |
| `max` | `number` | `1000` | Max entries before least-recently-used ones are evicted. |
| `staleWhileRevalidate` | `boolean` | `false` | Serve a stale value immediately and refresh in the background. |

### Methods

| Method | Returns | Description |
| --- | --- | --- |
| `get(key)` | `V \| undefined` | A fresh value, or `undefined` when missing or expired. |
| `set(key, value, ttl?)` | `void` | Stores a value, optionally overriding the TTL. |
| `has(key)` | `boolean` | Whether a fresh value exists. |
| `delete(key)` | `void` | Removes an entry. |
| `clear()` | `void` | Empties the cache. |
| `getOrFetch(key, fetcher, ttl?)` | `Promise<V>` | Cached value, or runs `fetcher` and caches the result. |

### `getOrFetch` - de-duplicated

```ts
const profile = await cache.getOrFetch(userId, () => api.getProfile(userId));
```

Concurrent calls for the same key share **one** in-flight request, so a burst of
interactions hits your API once, not fifty times.

### Stale-while-revalidate

```ts
const cache = createCache<string, Stats>({ ttl: "1m", staleWhileRevalidate: true });
```

Once a value expires, the next `getOrFetch` returns the **stale** value instantly and
refreshes in the background. The user never waits; the data is at most one TTL
old. Ideal for leaderboards, counters and dashboards - not for anything that
must be exact.

## Cache vs store

| | `createCache` | [`KVStore`](/djs-bot/api/store/) |
| --- | --- | --- |
| Reads | Synchronous | `async` |
| Survives a restart | No | With `sqliteStore` |
| Shared across shards | No | With a shared backend |
| Bounded / evicting | Yes (LRU) | No |
| Use for | Hot data, API responses | Real state: profiles, settings, tickets |

They pair well - cache in front, store behind:

```ts
const profile = await cache.getOrFetch(id, () => store.get(`profile:${id}`));
```

## `resolve` - cache-first entity lookups

discord.js already caches entities; these helpers read that cache and only call
the API on a miss. They save you the `cache.get(...) ?? await fetch(...)` dance
everywhere.

| Helper | Signature | Returns |
| --- | --- | --- |
| `resolve.member(guild, id, force?)` | | `Promise<GuildMember>` |
| `resolve.user(client, id, force?)` | | `Promise<User>` |
| `resolve.role(guild, id, force?)` | | `Promise<Role \| null>` |
| `resolve.channel(client, id, force?)` | | `Promise<Channel \| null>` |
| `resolve.message(channel, id, force?)` | | `Promise<Message>` |

```ts
import { resolve } from "@ix-xs/djs-bot";

const member = await resolve.member(ctx.guild!, targetId);
const fresh = await resolve.member(ctx.guild!, targetId, true);   // force a fetch
```

Pass `force: true` when you need current data - right after a role change, for
instance, where the cache would still show the old state.

:::tip[Cache what you compute, not what discord.js already caches]
Members, roles and channels are already cached by the client. Cache the
**result of your work** - an aggregated leaderboard, an external API response, a
rendered image - not the raw entities.
:::

## `TTLCache`

`createCache` is a thin wrapper over the exported class; `new TTLCache(options)`
is identical if you prefer it. The type parameters are `<K, V>`, so keys need
not be strings:

```ts
const perGuild = new TTLCache<string, Settings>({ ttl: "10m" });
```
